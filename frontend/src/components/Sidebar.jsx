import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PERSPECTIVES } from "../lib/constants";
import { useScorecard } from "../context/ScorecardContext";
import {
  overallScore, perspectiveScore, perspectiveRating, measureRating, rating, fmtPct,
} from "../lib/calculations";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Search, Grape, Users, ListTree, Trash2, Pencil, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DASH } from "../constants/testIds";

const Sidebar = ({ view, filters, setFilters, onAddDepartment, onEditDepartment, onDeleteDepartment }) => {
  const { project } = useScorecard();
  const [expanded, setExpanded] = useState({ perspectives: true, departments: true, kpis: false });
  const [search, setSearch] = useState("");

  const kpiIndex = useMemo(() => {
    if (!project) return [];
    const q = search.trim().toLowerCase();
    return project.measures
      .map((m) => {
        const obj = project.objectives.find((o) => o.id === m.objective_id);
        const dept = project.departments.find((d) => d.id === obj?.department_id);
        const targets = project.targets.filter((t) => t.measure_id === m.id);
        const avgPct = targets.length
          ? targets.reduce((a, t) => a + ((Number(t.actual_value) || 0) / (Number(t.target_value) || 1)) * 100, 0) / targets.length
          : 0;
        return { m, obj, dept, avgPct };
      })
      .filter((it) => !q || it.m.name.toLowerCase().includes(q) || (it.obj?.name || "").toLowerCase().includes(q));
  }, [project, search]);

  if (!project) return null;

  const overall = overallScore(project);
  // Headline dot follows the worst perspective, so the top-level light can never
  // be greener than something underneath it.
  const overallRag = PERSPECTIVES
    .map((p) => perspectiveRating(p.id, project.objectives, project.measures, project.targets, project.performance_thresholds))
    .reduce((worst, r) => (r === "red" || worst === "red" ? "red" : r === "amber" || worst === "amber" ? "amber" : "green"), "green");

  return (
    <aside
      data-testid={DASH.sidebar}
      className="hidden lg:flex w-72 shrink-0 flex-col border-r border-border bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))]"
    >
      <div className="px-5 pt-6 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full border border-sogrape-gold/50 flex items-center justify-center">
            <Grape className="h-4 w-4 text-sogrape-gold" />
          </div>
          <div>
            <div className="font-serif text-base leading-tight">{project.company_name}</div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-sogrape-gold/70">
              {project.fiscal_year || "Fiscal Year"} · Scorecard
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.25em] text-white/50">Overall balanced score</div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="font-serif text-3xl text-sogrape-gold" data-testid={DASH.overallScore}>
              {fmtPct(overall)}
            </div>
            <RagDot pct={overall} rating={overallRag} thresholds={project.performance_thresholds} />
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto sidebar-scroll px-2 py-3 text-sm">
        {/* Perspectives */}
        <SectionHead
          label="Perspectives"
          expanded={expanded.perspectives}
          onClick={() => setExpanded((s) => ({ ...s, perspectives: !s.perspectives }))}
          icon={<ListTree className="h-4 w-4 opacity-70" />}
        />
        {expanded.perspectives && (
          <div className="mb-4">
            <NavItem
              active={filters.perspective_id === null && view === "perspective"}
              onClick={() => setFilters((f) => ({ ...f, perspective_id: null }))}
              label="All perspectives"
              hint={`${project.objectives.length} obj.`}
            />
            {PERSPECTIVES.map((p) => {
              const ps = perspectiveScore(p.id, project.objectives, project.measures, project.targets);
              const cnt = project.objectives.filter((o) => o.perspective_id === p.id).length;
              return (
                <NavItem
                  key={p.id}
                  active={filters.perspective_id === p.id}
                  onClick={() => setFilters((f) => ({ ...f, perspective_id: p.id }))}
                  label={p.short}
                  hint={`${cnt} · ${fmtPct(ps)}`}
                  dotPct={ps}
                  dotRating={perspectiveRating(p.id, project.objectives, project.measures, project.targets, project.performance_thresholds)}
                  thresholds={project.performance_thresholds}
                  testId={`sidebar-perspective-${p.id}`}
                />
              );
            })}
          </div>
        )}

        {/* Departments */}
        <SectionHead
          label="Departments"
          expanded={expanded.departments}
          onClick={() => setExpanded((s) => ({ ...s, departments: !s.departments }))}
          icon={<Users className="h-4 w-4 opacity-70" />}
          action={
            <button
              onClick={onAddDepartment}
              data-testid={DASH.addDepartment}
              className="opacity-70 hover:opacity-100 hover:text-sogrape-gold"
              aria-label="Add department"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          }
        />
        {expanded.departments && (
          <div className="mb-4">
            <NavItem
              active={filters.department_id === null}
              onClick={() => setFilters((f) => ({ ...f, department_id: null }))}
              label="All departments"
            />
            {project.departments.map((d) => {
              const cnt = project.objectives.filter((o) => o.department_id === d.id).length;
              return (
                <div key={d.id} className="group flex items-center">
                  <NavItem
                    active={filters.department_id === d.id}
                    onClick={() => setFilters((f) => ({ ...f, department_id: d.id }))}
                    label={d.name}
                    hint={`${cnt}`}
                    className="flex-1"
                    testId={`sidebar-department-${d.id}`}
                  />
                  <div className="pr-2 hidden group-hover:flex gap-1 items-center">
                    <button onClick={() => onEditDepartment(d)} className="text-white/50 hover:text-sogrape-gold" aria-label="Edit">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button onClick={() => onDeleteDepartment(d)} className="text-white/50 hover:text-destructive" aria-label="Delete">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
            {project.departments.length === 0 && (
              <p className="px-3 py-2 text-xs text-white/50">No departments yet.</p>
            )}
          </div>
        )}

        {/* KPI index */}
        <SectionHead
          label="KPIs"
          expanded={expanded.kpis}
          onClick={() => setExpanded((s) => ({ ...s, kpis: !s.kpis }))}
          icon={<Search className="h-4 w-4 opacity-70" />}
        />
        {expanded.kpis && (
          <div className="mb-4">
            <div className="px-2 mb-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search measures…"
                className="h-8 bg-white/[0.04] border-white/10 text-[hsl(var(--sidebar-fg))] placeholder:text-white/40"
              />
            </div>
            <div className="max-h-80 overflow-y-auto sidebar-scroll">
              {kpiIndex.map(({ m, obj, dept, avgPct }) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setFilters((f) => ({ ...f, perspective_id: obj?.perspective_id || null }));
                  }}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-white/[0.05] transition-colors flex items-center gap-2"
                  data-testid={`sidebar-kpi-${m.id}`}
                >
                  <RagDot pct={avgPct} rating={measureRating(m, project.targets, project.performance_thresholds)} thresholds={project.performance_thresholds} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{m.name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-white/50 truncate">
                      {(obj?.name || "—")}{dept ? ` · ${dept.name}` : ""}
                    </div>
                  </div>
                  <div className="text-[10px] tabular-nums text-white/70">{fmtPct(avgPct, 0)}</div>
                </button>
              ))}
              {kpiIndex.length === 0 && (
                <p className="px-3 py-2 text-xs text-white/50">No measures yet.</p>
              )}
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-white/10 px-5 py-4 text-[10px] uppercase tracking-[0.28em] text-white/40">
        Family owned · Since 1942
      </div>
    </aside>
  );
};

const SectionHead = ({ label, expanded, onClick, icon, action }) => (
  <div className="flex items-center justify-between px-3 pt-3 pb-1">
    <button onClick={onClick} className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/60 hover:text-sogrape-gold">
      {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      {icon}
      {label}
    </button>
    {action}
  </div>
);

const NavItem = ({ active, onClick, label, hint, dotPct, dotRating, thresholds, className, testId }) => (
  <button
    onClick={onClick}
    data-testid={testId}
    className={cn(
      "w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors",
      active ? "bg-white/10 text-sogrape-gold" : "text-white/85 hover:bg-white/[0.05]",
      className
    )}
  >
    {typeof dotPct === "number" && <RagDot pct={dotPct} rating={dotRating} thresholds={thresholds} />}
    <span className="flex-1 truncate">{label}</span>
    {hint && <span className="text-[10px] text-white/50 tabular-nums">{hint}</span>}
  </button>
);

const RagDot = ({ pct, thresholds, rating: explicit }) => {
  const r = explicit || rating(pct, thresholds);
  const bg = r === "red" ? "bg-rag-red" : r === "amber" ? "bg-rag-amber" : "bg-rag-green";
  return <span className={cn("inline-block h-2 w-2 rounded-full", bg)} aria-hidden />;
};

export default Sidebar;
