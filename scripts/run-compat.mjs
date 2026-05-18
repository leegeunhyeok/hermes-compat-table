#!/usr/bin/env node
// Run compat-table specs against a built Hermes interpreter and write
// the pass/fail matrix to results/<tag>.json.
//
// Usage: node scripts/run-compat.mjs <tag>

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COMPAT_DIR = join(ROOT, "vendor/compat-table");
const SPECS_DIR = join(ROOT, "specs");
const RESULTS_DIR = join(ROOT, "results");
const SCRIPTS_DIR = join(ROOT, "scripts");

const args = process.argv.slice(2);
const tag = args[0];
if (!tag) {
  console.error("Usage: run-compat.mjs <tag>");
  process.exit(1);
}

const hermesBin = join(ROOT, "bin", tag, "hermes");
if (!existsSync(hermesBin)) {
  console.log(`[run:compat] hermes binary missing at ${hermesBin}`);
  console.log(`[run:compat] building hermes for ${tag}...`);
  const r = spawnSync(join(SCRIPTS_DIR, "build-hermes.sh"), [tag], {
    stdio: "inherit",
  });
  if (r.status !== 0) {
    console.error(`[run:compat] build failed (exit ${r.status})`);
    process.exit(r.status ?? 1);
  }
}

// Resolve compat-table data files from its directory so its relative
// requires (./data-common, ./test-utils/...) work.
const compatRequire = createRequire(join(COMPAT_DIR, "package.json"));

const dataFiles = [
  // Upstream kangax/compat-table data files (es5, es6, esintl, …).
  ...readdirSync(COMPAT_DIR)
    .filter((f) => /^data-[^.]+\.js$/.test(f))
    .map((f) => ({
      suite: f.replace(/^data-(.*)\.js$/, "$1"),
      path: join(COMPAT_DIR, f),
    })),
  // Custom suites local to this repo (reactnative, …). Drop a `.cjs`
  // file in `specs/` exporting { tests: [...] } to add a new suite.
  ...(existsSync(SPECS_DIR)
    ? readdirSync(SPECS_DIR)
        .filter((f) => /\.cjs$/.test(f))
        .map((f) => ({
          suite: f.replace(/\.cjs$/, ""),
          path: join(SPECS_DIR, f),
        }))
    : []),
];

const hermesVersionOut = execFileSync(hermesBin, ["-version"], {
  encoding: "utf8",
});
const releaseMatch = /Hermes release version:\s*(\S+)/.exec(hermesVersionOut);
const bytecodeMatch = /HBC bytecode version:\s*(\S+)/.exec(hermesVersionOut);
const hermesVersionLine = releaseMatch
  ? `Hermes ${releaseMatch[1]} (HBC ${bytecodeMatch?.[1] ?? "?"})`
  : hermesVersionOut.split("\n")[0];

const hermesSrcDir = join(ROOT, ".cache/hermes/src");
let hermesSha = null;
try {
  const ref = /^hermes-[0-9a-f]{7,40}$/.test(tag)
    ? tag.replace(/^hermes-/, "")
    : `refs/tags/${tag}^{commit}`;
  hermesSha = execFileSync(
    "git",
    ["-C", hermesSrcDir, "rev-parse", ref],
    { encoding: "utf8" },
  ).trim();
} catch {
  // Source dir or ref missing; leave sha null.
}

console.log(`[run:compat] tag=${tag}`);
console.log(`[run:compat] hermes=${hermesVersionLine}`);
console.log(`[run:compat] suites=${dataFiles.map((d) => d.suite).join(",")}`);

const tmpRoot = join(tmpdir(), `hermes-compat-${process.pid}`);
mkdirSync(tmpRoot, { recursive: true });

const results = [];
let executed = 0;
let pass = 0;
let skipped = 0;

for (const { suite, path } of dataFiles) {
  // compat-table data files require sibling files relatively; change
  // cwd via require resolved from COMPAT_DIR.
  const mod = compatRequire(path);
  if (!mod.tests) continue;

  for (const test of mod.tests) {
    walk(suite, test.category ?? null, [], test);
  }
}

mkdirSync(RESULTS_DIR, { recursive: true });
const outPath = join(RESULTS_DIR, `${tag}.json`);
writeFileSync(
  outPath,
  JSON.stringify(
    {
      tag,
      hermesSha,
      hermesVersion: hermesVersionLine,
      generatedAt: new Date().toISOString(),
      summary: { executed, pass, fail: executed - pass, skipped },
      results,
    },
    null,
    2,
  ),
);

console.log(
  `\n[run:compat] executed=${executed} pass=${pass} fail=${executed - pass} skipped=${skipped}`,
);
console.log(`[run:compat] wrote ${outPath}`);

function walk(suite, category, parents, test) {
  const code = extractTestCode(test.exec);
  if (code !== undefined) {
    const path = [...parents, test.name];
    const actual = runOne(suite, path, code);
    if (actual === "skip") {
      skipped++;
    } else {
      executed++;
      if (actual === true) pass++;
      results.push({ suite, category, path, pass: actual === true });
    }
  }

  if (Array.isArray(test.subtests)) {
    for (const sub of test.subtests) {
      walk(suite, category, [...parents, test.name], sub);
    }
  }
}

function extractTestCode(exec) {
  if (typeof exec === "function") {
    const src = exec.toString();
    const m = /^function\s*\w*\s*\(.*?\)\s*\{\s*\/\*([\s\S]*?)\*\/\s*\}$/m.exec(
      src,
    );
    if (m) return `(function () { ${removeIndent(m[1])} })()`;
    return `(${src})()`;
  }
  if (Array.isArray(exec)) {
    return exec.map((e) => extractTestCode(e.script)).join("; ");
  }
  return undefined;
}

function removeIndent(str) {
  const m = /^[\t ]+/m.exec(str);
  if (!m) return str;
  return str.replace(new RegExp("^" + m[0], "gm"), "");
}

function buildScript(evalcode) {
  let prelude = "";
  if (/\bglobal\b/.test(evalcode)) {
    prelude +=
      'if (typeof global === "undefined") { global = this; }\n';
  }
  if (/\bglobalThis\b/.test(evalcode)) {
    prelude +=
      'if (typeof globalThis === "undefined") { globalThis = this; }\n';
  }
  // Async-style tests use asyncTestPassed; we don't run a microtask
  // queue here, so they will simply not print [SUCCESS] and be marked
  // as fail. That's acceptable for a first pass.
  return (
    prelude +
    `var __code = ${JSON.stringify(evalcode)};\n` +
    `try { if (eval(__code)) { print("[SUCCESS]"); } } catch (e) {}\n`
  );
}

function runOne(suite, path, evalcode) {
  const script = buildScript(evalcode);
  const tmpFile = join(tmpRoot, "test.js");
  writeFileSync(tmpFile, script);
  try {
    const out = execFileSync(hermesBin, ["-w", tmpFile], {
      encoding: "utf8",
      timeout: 15_000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return /^\[SUCCESS\]$/m.test(out);
  } catch {
    return false;
  }
}

