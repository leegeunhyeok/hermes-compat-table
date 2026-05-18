import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  category: string | null;
  name: string;
  isLeaf: boolean;
  byTag: Record<string, GroupStatus>;
  subtests: SubtestRow[];
}

// compat-table palette
const COLOR_PASS = "#44ab44";
const COLOR_PARTIAL = "#acc20a";
const COLOR_FAIL = "#e11";

export function App() {
  const [selectedTags, setSelectedTags] = useState<string[]>(
    runs.map((r) => r.tag),
  );
  const [suite, setSuite] = useState<string>("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpanded = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

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

  const suiteStats = useMemo(
    () => buildSuiteStats(visibleRuns),
    [visibleRuns],
  );

  if (runs.length === 0) return <EmptyState />;

  return (
    <div className="mx-auto max-w-[1400px] p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Hermes Compat Table</h1>
        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label="View on GitHub"
        >
          <a
            href="https://github.com/leegeunhyeok/hermes-compat-table"
            target="_blank"
            rel="noreferrer noopener"
          >
            <GitHubIcon />
          </a>
        </Button>
      </header>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <SuiteSelect value={suite} onChange={setSuite} />
        <FilterSelect value={filter} onChange={setFilter} />
        <TagToggle
          tags={runs.map((r) => r.tag)}
          selected={selectedTags}
          onChange={setSelectedTags}
        />
      </div>

      <Matrix
        groups={visibleGroups}
        runs={visibleRuns}
        suiteStats={suiteStats}
        expanded={expanded}
        onToggle={toggleExpanded}
      />
    </div>
  );
}

function Matrix({
  groups,
  runs,
  suiteStats,
  expanded,
  onToggle,
}: {
  groups: SpecGroup[];
  runs: CompatRun[];
  suiteStats: Record<string, Record<string, GroupStatus>>;
  expanded: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow>
          <TableHead className="h-8 px-2">Spec</TableHead>
          {runs.map((r) => (
            <TableHead
              key={r.tag}
              className="h-8 px-2 text-center font-mono"
            >
              <div>{shortTag(r.tag)}</div>
              <div className="text-[10px] font-normal">
                {formatPct(r.summary.pass, r.summary.executed)}
              </div>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((g, i) => {
          const prev = i > 0 ? groups[i - 1]! : null;
          const showSuiteHeader = !prev || g.suite !== prev.suite;
          const showCategoryHeader =
            g.category != null &&
            (showSuiteHeader || g.category !== prev?.category);
          return (
            <Fragment key={g.key}>
              {showSuiteHeader && (
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableCell className="px-2 py-1.5 font-semibold uppercase tracking-wide">
                    {g.suite}
                  </TableCell>
                  {runs.map((r) => {
                    const s = suiteStats[g.suite]?.[r.tag];
                    return (
                      <TableCell
                        key={r.tag}
                        className="px-2 py-1.5 text-center font-mono text-muted-foreground"
                      >
                        {s ? formatPct(s.pass, s.total) : "—"}
                      </TableCell>
                    );
                  })}
                </TableRow>
              )}
              {showCategoryHeader && (
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell
                    colSpan={runs.length + 1}
                    className="px-2 py-1 pl-4 font-medium text-muted-foreground"
                  >
                    {g.category}
                  </TableCell>
                </TableRow>
              )}
              <GroupRows
                group={g}
                runs={runs}
                expanded={!!expanded[g.key]}
                onToggle={() => onToggle(g.key)}
              />
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

function formatPct(pass: number, total: number): string {
  if (total === 0) return "—";
  return `${((pass / total) * 100).toFixed(1)}%`;
}

function buildSuiteStats(
  runs: CompatRun[],
): Record<string, Record<string, GroupStatus>> {
  const out: Record<string, Record<string, GroupStatus>> = {};
  for (const run of runs) {
    for (const r of run.results) {
      let bySuite = out[r.suite];
      if (!bySuite) {
        bySuite = {};
        out[r.suite] = bySuite;
      }
      let s = bySuite[run.tag];
      if (!s) {
        s = { pass: 0, total: 0 };
        bySuite[run.tag] = s;
      }
      s.total++;
      if (r.pass) s.pass++;
    }
  }
  return out;
}

function GroupRows({
  group,
  runs,
  expanded,
  onToggle,
}: {
  group: SpecGroup;
  runs: CompatRun[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const isExpandable = !group.isLeaf;
  return (
    <>
      <TableRow>
        <TableCell
          className={`px-2 py-1.5 font-medium ${isExpandable ? "cursor-pointer select-none" : ""}`}
          onClick={isExpandable ? onToggle : undefined}
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 text-[10px] text-muted-foreground">
              {isExpandable ? (expanded ? "▾" : "▸") : ""}
            </span>
            <span>{group.name}</span>
          </span>
        </TableCell>
        {runs.map((r) => (
          <GroupStatusCell
            key={r.tag}
            s={group.byTag[r.tag]}
            isLeaf={group.isLeaf}
          />
        ))}
      </TableRow>
      {isExpandable &&
        expanded &&
        group.subtests.map((s) => (
          <TableRow key={s.key}>
            <TableCell className="px-2 py-1 pl-8 text-muted-foreground">
              {s.name}
            </TableCell>
            {runs.map((r) => (
              <ResultCell key={r.tag} v={s.byTag[r.tag]} />
            ))}
          </TableRow>
        ))}
    </>
  );
}

function GroupStatusCell({
  s,
  isLeaf,
}: {
  s: GroupStatus | undefined;
  isLeaf: boolean;
}) {
  if (!s || s.total === 0) {
    return (
      <TableCell className="px-2 py-1.5 text-center text-muted-foreground">
        —
      </TableCell>
    );
  }
  const allPass = s.pass === s.total;
  const allFail = s.pass === 0;
  const bg = allPass ? COLOR_PASS : allFail ? COLOR_FAIL : COLOR_PARTIAL;
  const label = isLeaf
    ? allPass
      ? "yes"
      : "no"
    : allPass
      ? `${s.total}/${s.total}`
      : allFail
        ? `0/${s.total}`
        : `${s.pass}/${s.total}`;
  return (
    <TableCell
      className="px-2 py-1.5 text-center font-mono text-white"
      style={{ backgroundColor: bg }}
    >
      {label}
    </TableCell>
  );
}

function ResultCell({ v }: { v: boolean | undefined }) {
  if (v === undefined) {
    return (
      <TableCell className="px-2 py-1 text-center text-muted-foreground">
        —
      </TableCell>
    );
  }
  const bg = v ? COLOR_PASS : COLOR_FAIL;
  return (
    <TableCell
      className="px-2 py-1 text-center font-mono text-white"
      style={{ backgroundColor: bg }}
    >
      {v ? "yes" : "no"}
    </TableCell>
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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (t: string) => {
    const on = selected.includes(t);
    if (on && selected.length === 1) return;
    onChange(on ? selected.filter((x) => x !== t) : [...selected, t]);
  };

  return (
    <div ref={rootRef} className="relative">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        className="font-mono text-xs"
      >
        Results · {selected.length}/{tags.length} ▾
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 min-w-[200px] rounded-md border bg-popover p-1 shadow-md">
          {tags.map((t) => {
            const on = selected.includes(t);
            const disabled = on && selected.length === 1;
            return (
              <label
                key={t}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm font-mono ${
                  disabled
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer hover:bg-accent"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5"
                  checked={on}
                  disabled={disabled}
                  onChange={() => toggle(t)}
                />
                <span>{shortTag(t)}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12.04c0 5.1 3.29 9.41 7.86 10.94.58.1.78-.25.78-.55v-1.94c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.74-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.26 5.69.41.36.78 1.06.78 2.14v3.17c0 .3.21.66.79.55 4.56-1.53 7.85-5.84 7.85-10.94C23.5 5.65 18.35.5 12 .5z" />
    </svg>
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
  const date = /^hermes-(\d{4}-\d{2}-\d{2})/.exec(tag);
  if (date) return `hermes-${date[1]}`;
  return tag.replace(/^hermes-v/, "v");
}

function buildGroups(runs: CompatRun[], suiteFilter: string): SpecGroup[] {
  type Acc = {
    suite: string;
    category: string | null;
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
          category: r.category ?? null,
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
      category: acc.category,
      name: acc.name,
      isLeaf: acc.isLeaf,
      byTag,
      subtests: acc.isLeaf ? [] : subtests,
    });
  }

  out.sort((a, b) => {
    if (a.suite !== b.suite) return a.suite.localeCompare(b.suite);
    const ca = a.category ?? "";
    const cb = b.category ?? "";
    if (ca !== cb) return ca.localeCompare(cb);
    return a.name.localeCompare(b.name);
  });
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
