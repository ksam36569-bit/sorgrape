import React, { useMemo, useState } from "react";
import { useScorecard } from "../context/ScorecardContext";
import {
  measureAchievement, measureRating, measureWeightedScore, latestActual, fmtPct,
} from "../lib/calculations";
import { PERSPECTIVE_MAP } from "../lib/constants";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, ArrowUpDown } from "lucide-react";

const DOT = { green: "bg-rag-green", amber: "bg-rag-amber", red: "bg-rag-red" };
const LABEL = { green: "On target", amber: "At risk", red: "Off track" };

/**
 * Every KPI in one flat, sortable table.
 *
 * The sidebar already has a KPI index, but it is a narrow jump-to list. This is
 * the same measures as a working table — achievement, status, weight, owner and
 * which objective each one serves — so they can be compared against each other
 * rather than read one at a time.
 */
const KpisView = () => {
  const { project } = useScorecard();
  const [query, setQuery] = useState("");
  const [perspective, setPerspective] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("achievement");

  const rows = useMemo(() => {
    if (!project) return [];
    const out = project.measures.map((m) => {
      const objective = project.objectives.find((o) => o.id === m.objective_id);
      return {
        m,
        objective,
        perspectiveId: objective?.perspective_id,
        achievement: measureAchievement(m, project.targets),
        weighted: measureWeightedScore(m, project.targets),
        rag: measureRating(m, project.targets, project.performance_thresholds),
        actual: latestActual(m, project.targets),
      };
    });

    const q = query.trim().toLowerCase();
    const filtered = out.filter((r) => {
      if (q && !`${r.m.name} ${r.objective?.name ?? ""} ${r.m.owner ?? ""}`.toLowerCase().includes(q)) return false;
      if (perspective !== "all" && r.perspectiveId !== perspective) return false;
      if (status !== "all" && r.rag !== status) return false;
      return true;
    });

    const cmp = {
      achievement: (a, b) => a.achievement - b.achievement, // worst first: that is the useful default
      name: (a, b) => a.m.name.localeCompare(b.m.name),
      weight: (a, b) => (Number(b.m.weight) || 0) - (Number(a.m.weight) || 0),
      perspective: (a, b) => String(a.perspectiveId).localeCompare(String(b.perspectiveId)),
    }[sort];
    return [...filtered].sort(cmp);
  }, [project, query, perspective, status, sort]);

  if (!project) return null;

  const counts = rows.reduce((acc, r) => ({ ...acc, [r.rag]: (acc[r.rag] || 0) + 1 }), {});

  return (
    <div className="space-y-4" data-testid="kpis-view">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Measures</div>
          <h2 className="font-serif text-3xl mt-1">KPIs</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Every measure across all four perspectives, worst first.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {["red", "amber", "green"].map((k) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${DOT[k]}`} aria-hidden />
              <span className="text-muted-foreground">{LABEL[k]}</span>
              <b className="tabular-nums">{counts[k] || 0}</b>
            </div>
          ))}
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search KPI, objective or owner…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-testid="kpis-search"
            />
          </div>
          <Select value={perspective} onValueChange={setPerspective}>
            <SelectTrigger className="w-[190px]" data-testid="kpis-perspective"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All perspectives</SelectItem>
              {Object.entries(PERSPECTIVE_MAP).map(([id, p]) => (
                <SelectItem key={id} value={id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[150px]" data-testid="kpis-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="green">On target</SelectItem>
              <SelectItem value="amber">At risk</SelectItem>
              <SelectItem value="red">Off track</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[190px]" data-testid="kpis-sort">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="achievement">Worst achievement first</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="weight">Heaviest weight first</SelectItem>
              <SelectItem value="perspective">Perspective</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2.5 px-4 font-medium">KPI</th>
                <th className="py-2.5 px-3 font-medium">Objective</th>
                <th className="py-2.5 px-3 font-medium text-right">Actual</th>
                <th className="py-2.5 px-3 font-medium text-right">Weight</th>
                <th className="py-2.5 px-3 font-medium text-right">Achievement</th>
                <th className="py-2.5 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ m, objective, perspectiveId, achievement, actual, rag }) => (
                <tr key={m.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40 transition-colors" data-testid={`kpi-row-${m.id}`}>
                  <td className="py-2.5 px-4">
                    <div className="font-medium">{m.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {PERSPECTIVE_MAP[perspectiveId]?.short || "—"}
                      {m.owner ? ` · ${m.owner}` : ""}
                      {m.direction === "lower" ? " · lower is better" : ""}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground max-w-[280px] truncate">{objective?.name || "—"}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{actual === null ? "—" : `${actual}${m.unit || ""}`}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">{m.weight || 0}%</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-medium">{fmtPct(achievement, 1)}</td>
                  <td className="py-2.5 px-4">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className={`h-2 w-2 rounded-full ${DOT[rag]}`} aria-hidden />
                      {LABEL[rag]}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-sm text-muted-foreground italic">No KPIs match those filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default KpisView;
