import { Fragment, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
    <TooltipProvider delayDuration={150}>
    <div className="mx-auto max-w-[1400px] p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Hermes Compat Table</h1>
        <div className="flex items-center gap-1">
          <SettingsDialog
            suite={suite}
            onSuiteChange={setSuite}
            filter={filter}
            onFilterChange={setFilter}
            runs={runs}
            selectedTags={selectedTags}
            onSelectedTagsChange={setSelectedTags}
          />
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
        </div>
      </header>

      <Matrix
        groups={visibleGroups}
        runs={visibleRuns}
        suiteStats={suiteStats}
        expanded={expanded}
        onToggle={toggleExpanded}
      />
    </div>
    </TooltipProvider>
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
              className="px-2 py-1.5 text-center font-mono align-bottom"
            >
              <div className="flex justify-center gap-1 pb-1">
                {r.reactNativeVersion && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className="px-1.5 py-0 text-[9px] font-medium cursor-help"
                      >
                        {r.reactNativeVersion}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>React Native version</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      className={`border-transparent px-1.5 py-0 text-[9px] font-medium text-white cursor-help ${typeBadgeColor(r.type)}`}
                    >
                      {typeLabel(r.type)}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>{typeTooltip(r.type)}</TooltipContent>
                </Tooltip>
              </div>
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

function SettingsDialog({
  suite,
  onSuiteChange,
  filter,
  onFilterChange,
  runs,
  selectedTags,
  onSelectedTagsChange,
}: {
  suite: string;
  onSuiteChange: (v: string) => void;
  filter: Filter;
  onFilterChange: (v: Filter) => void;
  runs: CompatRun[];
  selectedTags: string[];
  onSelectedTagsChange: (next: string[]) => void;
}) {
  const toggleTag = (t: string) => {
    const on = selectedTags.includes(t);
    if (on && selectedTags.length === 1) return;
    onSelectedTagsChange(
      on ? selectedTags.filter((x) => x !== t) : [...selectedTags, t],
    );
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Settings">
          <SettingsIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Filter the compatibility matrix.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section>
            <h3 className="mb-2 text-sm font-semibold">Suite</h3>
            <RadioGroup
              value={suite}
              onValueChange={onSuiteChange}
              className="grid grid-cols-2 gap-2"
            >
              <RadioOption value="all" id="suite-all" label="All suites" />
              {allSuites.map((s) => (
                <RadioOption key={s} value={s} id={`suite-${s}`} label={s} />
              ))}
            </RadioGroup>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Specs</h3>
            <RadioGroup
              value={filter}
              onValueChange={(v) => onFilterChange(v as Filter)}
            >
              <RadioOption value="all" id="filter-all" label="All specs" />
              <RadioOption
                value="anyFail"
                id="filter-anyFail"
                label="Any failing"
              />
              <RadioOption
                value="diff"
                id="filter-diff"
                label="Differing across hermes versions"
              />
            </RadioGroup>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Results</h3>
            <div className="grid gap-2">
              {runs.map((r) => {
                const t = r.tag;
                const on = selectedTags.includes(t);
                const disabled = on && selectedTags.length === 1;
                const id = `tag-${t}`;
                return (
                  <div key={t} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={on}
                      disabled={disabled}
                      onCheckedChange={() => toggleTag(t)}
                    />
                    <Label
                      htmlFor={id}
                      className={`flex items-center gap-2 font-mono text-sm ${disabled ? "opacity-60" : "cursor-pointer"}`}
                    >
                      <span>{shortTag(t)}</span>
                      {r.reactNativeVersion && (
                        <Badge
                          variant="outline"
                          className="px-1.5 py-0 text-[9px] font-medium"
                        >
                          {r.reactNativeVersion}
                        </Badge>
                      )}
                    </Label>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RadioOption({
  value,
  id,
  label,
}: {
  value: string;
  id: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <RadioGroupItem value={value} id={id} />
      <Label htmlFor={id} className="cursor-pointer font-normal">
        {label}
      </Label>
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
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

function typeLabel(type: CompatRun["type"]): string {
  switch (type) {
    case "hermes-legacy":
      return "legacy";
    case "hermes-v1":
      return "v1";
    case "static-hermes":
      return "static";
  }
}

function typeTooltip(type: CompatRun["type"]): string {
  switch (type) {
    case "hermes-legacy":
      return "Older Hermes engine.";
    case "hermes-v1":
      return "Next-gen Hermes engine, introduced in React Native 0.82.";
    case "static-hermes":
      return "Upcoming next-gen engine. Not yet officially released.";
  }
}

function typeBadgeColor(type: CompatRun["type"]): string {
  switch (type) {
    case "hermes-legacy":
      return "bg-slate-500 hover:bg-slate-500/80";
    case "hermes-v1":
      return "bg-sky-600 hover:bg-sky-600/80";
    case "static-hermes":
      return "bg-emerald-600 hover:bg-emerald-600/80";
  }
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
