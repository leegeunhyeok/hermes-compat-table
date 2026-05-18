import manifest from "../../results/manifest.json";

export interface CompatResultRow {
  suite: string;
  category: string | null;
  path: string[];
  pass: boolean;
}

export type HermesType = "hermes-legacy" | "hermes-v1" | "static-hermes";

export interface ManifestEntry {
  label: string;
  type: HermesType;
  reactNativeVersion?: string;
}

export interface CompatRun {
  tag: string;
  hermesSha: string | null;
  hermesVersion: string;
  generatedAt: string;
  summary: { executed: number; pass: number; fail: number; skipped: number };
  results: CompatResultRow[];
  type: HermesType;
  reactNativeVersion?: string;
}

interface RawRun extends Omit<CompatRun, "type" | "reactNativeVersion"> {}

const modules = import.meta.glob<RawRun>("/results/hermes-*.json", {
  eager: true,
  import: "default",
});

const byTag = new Map<string, RawRun>();
for (const m of Object.values(modules)) byTag.set(m.tag, m);

export const runs: CompatRun[] = (manifest as ManifestEntry[]).flatMap(
  (entry): CompatRun[] => {
    const run = byTag.get(entry.label);
    if (!run) return [];
    const merged: CompatRun = { ...run, type: entry.type };
    if (entry.reactNativeVersion !== undefined) {
      merged.reactNativeVersion = entry.reactNativeVersion;
    }
    return [merged];
  },
);

export const allSuites: string[] = Array.from(
  new Set(runs.flatMap((r) => r.results.map((x) => x.suite))),
).sort();

export function specKey(suite: string, path: string[]): string {
  return `${suite}|${path.join(" > ")}`;
}
