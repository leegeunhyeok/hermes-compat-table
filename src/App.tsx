import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { runs, allSuites, specKey, type CompatRun } from "@/data/results";

type Filter = "all" | "anyFail" | "diff";

export function App() {
  const [selectedTags, setSelectedTags] = useState<string[]>(
    runs.map((r) => r.tag),
  );
  const [suite, setSuite] = useState<string>("all");
  const [filter, setFilter] = useState<Filter>("anyFail");

  const visibleRuns = useMemo(
    () => runs.filter((r) => selectedTags.includes(r.tag)),
    [selectedTags],
  );

  const matrix = useMemo(
    () => buildMatrix(visibleRuns, suite),
    [visibleRuns, suite],
  );

  const filteredRows = useMemo(() => {
    if (filter === "all") return matrix.rows;
    if (filter === "anyFail")
      return matrix.rows.filter((row) =>
        visibleRuns.some((r) => row.byTag[r.tag] === false),
      );
    return matrix.rows.filter((row) => {
      const vals = visibleRuns
        .map((r) => row.byTag[r.tag])
        .filter((v) => v !== undefined);
      return vals.some((v) => v !== vals[0]);
    });
  }, [matrix.rows, filter, visibleRuns]);

  if (runs.length === 0) {
    return <EmptyState />;
  }

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

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
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
        <CardContent>
          <div className="text-sm text-muted-foreground mb-3">
            Showing {filteredRows.length} of {matrix.rows.length} spec
            {matrix.rows.length === 1 ? "" : "s"}
            {filter === "anyFail" && " (with at least one failure)"}
            {filter === "diff" && " (differing across selected tags)"}
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Spec</TableHead>
                  <TableHead className="w-[120px]">Suite</TableHead>
                  {visibleRuns.map((r) => (
                    <TableHead key={r.tag} className="whitespace-nowrap">
                      {shortTag(r.tag)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-mono text-xs">
                      {row.path.join(" › ")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.suite}</Badge>
                    </TableCell>
                    {visibleRuns.map((r) => (
                      <TableCell key={r.tag}>
                        <ResultDot value={row.byTag[r.tag]} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
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

function ResultDot({ value }: { value: boolean | undefined }) {
  if (value === undefined)
    return <span className="text-muted-foreground">—</span>;
  return value ? (
    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
  ) : (
    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
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

interface MatrixRow {
  key: string;
  suite: string;
  path: string[];
  byTag: Record<string, boolean | undefined>;
}

function buildMatrix(
  runs: CompatRun[],
  suiteFilter: string,
): { rows: MatrixRow[] } {
  const rowMap = new Map<string, MatrixRow>();
  for (const run of runs) {
    for (const r of run.results) {
      if (suiteFilter !== "all" && r.suite !== suiteFilter) continue;
      const key = specKey(r.suite, r.path);
      let row = rowMap.get(key);
      if (!row) {
        row = { key, suite: r.suite, path: r.path, byTag: {} };
        rowMap.set(key, row);
      }
      row.byTag[run.tag] = r.pass;
    }
  }
  return { rows: Array.from(rowMap.values()) };
}
