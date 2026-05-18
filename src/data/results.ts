export interface CompatResultRow {
  suite: string;
  category: string | null;
  path: string[];
  pass: boolean;
}

export interface CompatRun {
  tag: string;
  hermesSha: string | null;
  hermesVersion: string;
  generatedAt: string;
  summary: { executed: number; pass: number; fail: number; skipped: number };
  results: CompatResultRow[];
}

const modules = import.meta.glob<CompatRun>("/results/*.json", {
  eager: true,
  import: "default",
});

export const runs: CompatRun[] = Object.values(modules).sort((a, b) =>
  a.tag.localeCompare(b.tag),
);

export const allSuites: string[] = Array.from(
  new Set(runs.flatMap((r) => r.results.map((x) => x.suite))),
).sort();

export function specKey(suite: string, path: string[]): string {
  return `${suite}|${path.join(" > ")}`;
}
