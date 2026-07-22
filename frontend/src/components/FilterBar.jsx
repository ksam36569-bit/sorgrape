import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PERSPECTIVES, PRIORITY_OPTIONS, STATUS_OPTIONS, RISK_OPTIONS } from "../lib/constants";
import { useScorecard } from "../context/ScorecardContext";
import { X, Filter as FilterIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ANY = "__any__";

/**
 * Combinable filter bar. Filter values are simple strings; parent maintains state.
 * Fields: department_id, perspective_id, owner, quarter, year, status, priority, risk
 */
const FilterBar = ({ filters, setFilters, showRisk = false }) => {
  const { project } = useScorecard();
  const owners = React.useMemo(() => {
    const set = new Set();
    for (const o of project?.objectives || []) if (o.owner) set.add(o.owner);
    for (const m of project?.measures || []) if (m.owner) set.add(m.owner);
    for (const i of project?.initiatives || []) if (i.owner) set.add(i.owner);
    return Array.from(set).sort();
  }, [project]);

  const { quarters, years } = React.useMemo(() => {
    const qs = new Set(), ys = new Set();
    for (const t of project?.targets || []) {
      const p = (t.period || "").toString();
      if (/^Q[1-4]/i.test(p)) qs.add(p);
      const m = p.match(/(FY\d{2,4}|20\d{2})/);
      if (m) ys.add(m[1]);
    }
    return { quarters: Array.from(qs).sort(), years: Array.from(ys).sort() };
  }, [project]);

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v === ANY ? null : v }));

  const active = Object.values(filters).filter((v) => v).length;

  const clear = () => setFilters({ perspective_id: null, department_id: null, owner: null, quarter: null, year: null, status: null, priority: null, risk: null });

  return (
    <div className="flex flex-wrap items-center gap-2 py-2" data-testid="filter-bar">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-[0.28em] text-muted-foreground mr-1">
        <FilterIcon className="h-3 w-3" />
        Filters
      </div>

      <FilterSelect label="Perspective" value={filters.perspective_id} onChange={(v) => set("perspective_id", v)} testId="filter-perspective">
        {PERSPECTIVES.map((p) => <SelectItem key={p.id} value={p.id}>{p.short}</SelectItem>)}
      </FilterSelect>

      <FilterSelect label="Department" value={filters.department_id} onChange={(v) => set("department_id", v)} testId="filter-department">
        {(project?.departments || []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
      </FilterSelect>

      {owners.length > 0 && (
        <FilterSelect label="Owner" value={filters.owner} onChange={(v) => set("owner", v)} testId="filter-owner">
          {owners.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </FilterSelect>
      )}

      {quarters.length > 0 && (
        <FilterSelect label="Quarter" value={filters.quarter} onChange={(v) => set("quarter", v)} testId="filter-quarter">
          {quarters.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
        </FilterSelect>
      )}

      {years.length > 0 && (
        <FilterSelect label="Year" value={filters.year} onChange={(v) => set("year", v)} testId="filter-year">
          {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
        </FilterSelect>
      )}

      <FilterSelect label="Status" value={filters.status} onChange={(v) => set("status", v)} testId="filter-status">
        {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
      </FilterSelect>

      <FilterSelect label="Priority" value={filters.priority} onChange={(v) => set("priority", v)} testId="filter-priority">
        {PRIORITY_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
      </FilterSelect>

      {showRisk && (
        <FilterSelect label="Risk" value={filters.risk} onChange={(v) => set("risk", v)} testId="filter-risk">
          {RISK_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </FilterSelect>
      )}

      {active > 0 && (
        <Button variant="ghost" size="sm" onClick={clear} className="h-8 text-xs">
          <X className="h-3 w-3 mr-1" /> Clear ({active})
        </Button>
      )}
    </div>
  );
};

const FilterSelect = ({ label, value, onChange, children, testId }) => (
  <div className={cn("flex items-center gap-1.5")}>
    <Select value={value || ANY} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-fit min-w-[130px] text-xs" data-testid={testId}>
        <span className="text-muted-foreground mr-1.5">{label}:</span>
        <SelectValue placeholder="Any" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>Any</SelectItem>
        {children}
      </SelectContent>
    </Select>
  </div>
);

/** Predicate helper — apply filters to an objective + its measures/targets/initiatives */
export const applyObjectiveFilter = (project, objective, filters) => {
  if (filters.perspective_id && objective.perspective_id !== filters.perspective_id) return false;
  if (filters.department_id && objective.department_id !== filters.department_id) return false;
  if (filters.status && objective.status !== filters.status) return false;
  if (filters.priority && objective.priority !== filters.priority) return false;
  if (filters.owner) {
    const measures = project.measures.filter((m) => m.objective_id === objective.id);
    const anyOwner = objective.owner === filters.owner || measures.some((m) => m.owner === filters.owner);
    if (!anyOwner) return false;
  }
  if (filters.quarter || filters.year) {
    const measureIds = project.measures.filter((m) => m.objective_id === objective.id).map((m) => m.id);
    const ts = project.targets.filter((t) => measureIds.includes(t.measure_id));
    const match = ts.some((t) => {
      const p = t.period || "";
      const qOk = !filters.quarter || p === filters.quarter || p.startsWith(filters.quarter);
      const yOk = !filters.year || p.includes(filters.year);
      return qOk && yOk;
    });
    if (!match) return false;
  }
  return true;
};

export default FilterBar;
