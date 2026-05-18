import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { runs, allSuites, type CompatRun } from "@/data/results";

type Filter = "all" | "anyFail" | "diff";

interface GroupStatus {
  pass: number;
  total: number;
}

interface SubtestRow {
  key: string;
  name: string;
  byTag: Record<string, boolean | undefined>;
}

interface SpecGroup {
  key: string;
  suite: string;
  name: string;
  isLeaf: boolean;
  byTag: Record<string, GroupStatus>;
  subtests: SubtestRow[];
}

const SPEC_COL_W = 320;
const SUITE_COL_W = 84;

export function App() {
  const [selectedTags, setSelectedTags] = useState<string[]>(
    runs.map((r) => r.tag),
  );
  const [suite, setSuite] = useState<string>("all");
  const [filter, setFilter] = useState<Filter>("all");

  const visibleRuns = useMemo(
    () => runs.filter((r) => selectedTags.includes(r.tag)),
    [selectedTags],
  );

  const groups = useMemo(
    () => buildGroups(visibleRuns, suite),
    [visibleRuns, suite],
  );

  const visibleGroups = useMemo(
    () => filterGroups(groups, filter, visibleRuns),
    [groups, filter, visibleRuns],
  );

  if (runs.length === 0) return <EmptyState />;

  return (
    <div className="mx-auto max-w-[1400px] p-6 space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hermes Compat Table</h1>
          <p className="text-sm text-muted-foreground">
            compat-table spec results across Hermes release tags
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {runs.length} run{runs.length === 1 ? "" : "s"} indexed
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {visibleRuns.map((r) => (
          <SummaryCard key={r.tag} run={r} />
        ))}
      </section>

      <Card className="py-0 gap-0">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3 p-5">
          <CardTitle>Compatibility matrix</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <SuiteSelect value={suite} onChange={setSuite} />
            <FilterSelect value={filter} onChange={setFilter} />
            <TagToggle
              tags={runs.map((r) => r.tag)}
              selected={selectedTags}
              onChange={setSelectedTags}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="px-5 py-2 text-xs text-muted-foreground border-t">
            Showing {visibleGroups.length} of {groups.length} group
            {groups.length === 1 ? "" : "s"}
            {filter === "anyFail" && " · only rows with at least one failure"}
            {filter === "diff" && " · only rows differing across selected tags"}
          </div>
          <Matrix groups={visibleGroups} runs={visibleRuns} />
        </CardContent>
      </Card>
    </div>
  );
}

function Matrix({
  groups,
  runs,
}: {
  groups: SpecGroup[];
  runs: CompatRun[];
}) {
  return (
    <div className="overflow-x-auto border-t">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <th
              className="sticky left-0 z-20 bg-muted/50 px-3 py-2 text-left font-medium"
              style={{ minWidth: SPEC_COL_W }}
            >
              Spec
            </th>
            <th
              className="sticky z-20 bg-muted/50 px-3 py-2 text-left font-medium"
              style={{ left: SPEC_COL_W, minWidth: SUITE_COL_W }}
            >
              Suite
            </th>
            {runs.map((r) => (
              <th
                key={r.tag}
                className="px-3 py-2 text-center font-mono text-xs font-medium normal-case tracking-normal"
                style={{ minWidth: 88 }}
              >
                {shortTag(r.tag)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <GroupRows key={g.key} group={g} runs={runs} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({ group, runs }: { group: SpecGroup; runs: CompatRun[] }) {
  const groupBg = "bg-muted/30";
  return (
    <>
      <tr className={`${groupBg} border-t`}>
        <td
          className={`${groupBg} sticky left-0 z-10 px-3 py-2 font-medium`}
          style={{ minWidth: SPEC_COL_W }}
        >
          {group.name}
        </td>
        <td
          className={`${groupBg} sticky z-10 px-3 py-2`}
          style={{ left: SPEC_COL_W, minWidth: SUITE_COL_W }}
        >
          <Badge variant="outline" className="font-mono text-[10px]">
            {group.suite}
          </Badge>
        </td>
        {runs.map((r) => (
          <td key={r.tag} className="px-3 py-2 text-center">
            <GroupStatusCell s={group.byTag[r.tag]} />
          </td>
        ))}
      </tr>
      {!group.isLeaf &&
        group.subtests.map((s) => (
          <tr key={s.key} className="bg-background border-t border-muted/40">
            <td
              className="bg-background sticky left-0 z-10 px-3 py-1.5 pl-8 text-xs text-muted-foreground"
              style={{ minWidth: SPEC_COL_W }}
            >
              {s.name}
            </td>
            <td
              className="bg-background sticky z-10 px-3 py-1.5"
              style={{ left: SPEC_COL_W, minWidth: SUITE_COL_W }}
            />
            {runs.map((r) => (
              <td key={r.tag} className="px-3 py-1.5 text-center">
                <ResultDot v={s.byTag[r.tag]} />
              </td>
            ))}
          </tr>
        ))}
    </>
  );
}

function GroupStatusCell({ s }: { s: GroupStatus | undefined }) {
  if (!s || s.total === 0)
    return <span className="text-muted-foreground">—</span>;
  if (s.pass === s.total)
    return (
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
    );
  if (s.pass === 0)
    return (
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />
    );
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
      <span className="font-mono text-[10px] text-muted-foreground">
        {s.pass}/{s.total}
      </span>
    </span>
  );
}

function ResultDot({ v }: { v: boolean | undefined }) {
  if (v === undefined)
    return <span className="text-muted-foreground">—</span>;
  return v ? (
    <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
  ) : (
    <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />
  );
}

function SummaryCard({ run }: { run: CompatRun }) {
  const ratio = (run.summary.pass / Math.max(1, run.summary.executed)) * 100;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-mono">{run.tag}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-3xl font-semibold">
          {ratio.toFixed(1)}
          <span className="text-base text-muted-foreground">%</span>
        </div>
        <div className="text-sm text-muted-foreground">
          {run.summary.pass} pass / {run.summary.fail} fail /{" "}
          {run.summary.executed} total
        </div>
        <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
          <span>{run.hermesVersion}</span>
          {run.hermesSha && (
            <span className="font-mono">· {run.hermesSha.slice(0, 7)}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SuiteSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder="Suite" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All suites</SelectItem>
        {allSuites.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FilterSelect({
  value,
  onChange,
}: {
  value: Filter;
  onChange: (v: Filter) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Filter)}>
      <SelectTrigger className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All specs</SelectItem>
        <SelectItem value="anyFail">Any failing</SelectItem>
        <SelectItem value="diff">Differing across tags</SelectItem>
      </SelectContent>
    </Select>
  );
}

function TagToggle({
  tags,
  selected,
  onChange,
}: {
  tags: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => {
        const on = selected.includes(t);
        return (
          <Button
            key={t}
            size="sm"
            variant={on ? "default" : "outline"}
            onClick={() => {
              if (on && selected.length === 1) return;
              onChange(
                on ? selected.filter((x) => x !== t) : [...selected, t],
              );
            }}
            className="font-mono text-xs"
          >
            {shortTag(t)}
          </Button>
        );
      })}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-12 text-center text-muted-foreground">
      No results found in <code>results/</code>. Run{" "}
      <code>mise run run:compat &lt;tag&gt;</code> first.
    </div>
  );
}

function shortTag(tag: string): string {
  return tag.replace(/^hermes-v/, "v");
}

function buildGroups(runs: CompatRun[], suiteFilter: string): SpecGroup[] {
  type Acc = {
    suite: string;
    name: string;
    isLeaf: boolean;
    subtestMap: Map<string, SubtestRow>;
  };
  const map = new Map<string, Acc>();

  for (const run of runs) {
    for (const r of run.results) {
      if (suiteFilter !== "all" && r.suite !== suiteFilter) continue;
      const groupKey = `${r.suite}|${r.path[0]}`;
      let acc = map.get(groupKey);
      if (!acc) {
        acc = {
          suite: r.suite,
          name: r.path[0],
          isLeaf: r.path.length === 1,
          subtestMap: new Map(),
        };
        map.set(groupKey, acc);
      }
      // depth-1 leaf: one synthetic subtest under "_leaf_"
      const subKey =
        r.path.length === 1 ? "_leaf_" : r.path.slice(1).join(" › ");
      let sub = acc.subtestMap.get(subKey);
      if (!sub) {
        sub = { key: `${groupKey}|${subKey}`, name: subKey, byTag: {} };
        acc.subtestMap.set(subKey, sub);
      }
      sub.byTag[run.tag] = r.pass;
    }
  }

  const out: SpecGroup[] = [];
  for (const [key, acc] of map) {
    const subtests = Array.from(acc.subtestMap.values());
    const byTag: Record<string, GroupStatus> = {};
    for (const run of runs) {
      let pass = 0;
      let total = 0;
      for (const s of subtests) {
        const v = s.byTag[run.tag];
        if (v === undefined) continue;
        total++;
        if (v) pass++;
      }
      byTag[run.tag] = { pass, total };
    }
    out.push({
      key,
      suite: acc.suite,
      name: acc.name,
      isLeaf: acc.isLeaf,
      byTag,
      subtests: acc.isLeaf ? [] : subtests,
    });
  }

  out.sort((a, b) =>
    a.suite === b.suite
      ? a.name.localeCompare(b.name)
      : a.suite.localeCompare(b.suite),
  );
  return out;
}

function filterGroups(
  groups: SpecGroup[],
  filter: Filter,
  runs: CompatRun[],
): SpecGroup[] {
  if (filter === "all") return groups;
  const result: SpecGroup[] = [];
  for (const g of groups) {
    if (g.isLeaf) {
      const vals = runs.map((r) => g.byTag[r.tag]);
      const allPass = vals.every((v) => v && v.pass === v.total && v.total > 0);
      const allSame = vals.every(
        (v) =>
          v &&
          v.pass === vals[0]?.pass &&
          v.total === vals[0]?.total,
      );
      if (filter === "anyFail" && allPass) continue;
      if (filter === "diff" && allSame) continue;
      result.push(g);
      continue;
    }
    const subtests = g.subtests.filter((s) => {
      const vals = runs.map((r) => s.byTag[r.tag]);
      if (filter === "anyFail") return vals.some((v) => v === false);
      const first = vals[0];
      return vals.some((v) => v !== first);
    });
    if (subtests.length === 0) continue;

    // Recompute group aggregate for the filtered subset so the header
    // reflects what's visible.
    const byTag: Record<string, GroupStatus> = {};
    for (const run of runs) {
      let pass = 0;
      let total = 0;
      for (const s of subtests) {
        const v = s.byTag[run.tag];
        if (v === undefined) continue;
        total++;
        if (v) pass++;
      }
      byTag[run.tag] = { pass, total };
    }
    result.push({ ...g, subtests, byTag });
  }
  return result;
}
