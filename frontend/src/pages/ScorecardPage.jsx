import React, { useMemo, useState, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { useScorecard } from "../context/ScorecardContext";
import Sidebar from "../components/Sidebar";
import ThemeToggle from "../components/ThemeToggle";
import ObjectiveDialog from "../components/ObjectiveDialog";
import MeasureDialog from "../components/MeasureDialog";
import BulkImportDialog from "../components/BulkImportDialog";
import DepartmentDialog from "../components/DepartmentDialog";
import AiSummaryDialog from "../components/AiSummaryDialog";
import ObjectiveCard from "../components/ObjectiveCard";
import PerformanceBadge from "../components/PerformanceBadge";
import FilterBar, { applyObjectiveFilter } from "../components/FilterBar";

// Only one section renders at a time, so each is its own chunk. Dashboard pulls
// in recharts, Strategy Map pulls in reactflow, and Reports pulls in the export
// libraries — none of which should load for someone just reading the scorecard.
const DashboardChartsView = lazy(() => import("./DashboardChartsView"));
const StrategyMapView = lazy(() => import("./StrategyMapView"));
const AlignmentView = lazy(() => import("./AlignmentView"));
const InitiativesView = lazy(() => import("./InitiativesView"));
const ReportsView = lazy(() => import("./ReportsView"));
const OkrsView = lazy(() => import("./OkrsView"));
const KpisView = lazy(() => import("./KpisView"));
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, Grape, FolderKanban, Sparkles, BarChart3, Network, Layers, Rocket, FileText, ClipboardList, Target, Gauge } from "lucide-react";
import {
  overallScore, perspectiveScore, perspectiveObjectiveWeightSum, totalPerspectiveWeight, fmtPct, perspectiveRating, overallRating,
} from "../lib/calculations";
import { PERSPECTIVES, PERSPECTIVE_MAP } from "../lib/constants";
import { DASH, SECTION } from "../constants/testIds";
import { toast } from "sonner";
import { api } from "../lib/api";
import { motion } from "framer-motion";

const DEFAULT_FILTERS = { perspective_id: null, department_id: null, owner: null, quarter: null, year: null, status: null, priority: null, risk: null };

function SectionFallback() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-label="Loading section">
      <div className="h-7 w-7 rounded-full border-2 border-muted border-t-primary animate-spin" />
    </div>
  );
}

const ScorecardPage = () => {
  const { project, projects, loadProject, refreshProject, currentProjectId } = useScorecard();
  const navigate = useNavigate();

  const [section, setSection] = useState("scorecard"); // scorecard | dashboard | okrs | kpis | strategy-map | alignment | initiatives | reports
  const [view, setView] = useState("perspective"); // sub-view inside scorecard
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const [objDialog, setObjDialog] = useState({ open: false, objective: null, defaultPerspective: null, defaultDepartment: null });
  const [measureDialog, setMeasureDialog] = useState({ open: false, measure: null, defaultObjective: null });
  const [importOpen, setImportOpen] = useState(false);
  const [deptDialog, setDeptDialog] = useState({ open: false, initial: null });
  const [aiOpen, setAiOpen] = useState(false);

  const objectivesFiltered = useMemo(() => {
    if (!project) return [];
    return project.objectives.filter((o) => applyObjectiveFilter(project, o, filters));
  }, [project, filters]);

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <FolderKanban className="h-8 w-8 mx-auto text-muted-foreground" />
          <h2 className="font-serif text-2xl">No scorecard loaded</h2>
          <p className="text-sm text-muted-foreground">Create a new scorecard, or pick one you've built earlier.</p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate("/setup")}>Create new scorecard</Button>
            {projects.length > 0 && (
              <Select onValueChange={(v) => loadProject(v)}>
                <SelectTrigger><SelectValue placeholder="Load existing…" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.company_name}{p.fiscal_year ? ` · ${p.fiscal_year}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </Card>
      </div>
    );
  }

  const overall = overallScore(project);
  const totalPWeight = totalPerspectiveWeight(project);

  const addDept = async (name) => {
    try { await api.addDepartment(project.id, name); await refreshProject(); toast.success("Department added"); }
    catch { toast.error("Could not add department"); }
  };
  const editDept = async (name) => {
    try { await api.updateDepartment(project.id, deptDialog.initial.id, name); await refreshProject(); toast.success("Department updated"); }
    catch { toast.error("Could not update"); }
  };
  const deleteDept = async (d) => {
    if (!window.confirm(`Delete department "${d.name}"?`)) return;
    try { await api.deleteDepartment(project.id, d.id); await refreshProject(); toast.success("Department removed"); }
    catch { toast.error("Could not delete"); }
  };

  const showScorecardTools = section === "scorecard";

  return (
    <div className="min-h-screen flex bg-background text-foreground" data-testid={DASH.root}>
      <Sidebar
        view={view}
        filters={filters}
        setFilters={setFilters}
        onAddDepartment={() => setDeptDialog({ open: true, initial: null })}
        onEditDepartment={(d) => setDeptDialog({ open: true, initial: d })}
        onDeleteDepartment={deleteDept}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="border-b border-border bg-card/60 backdrop-blur" data-print-hide="true">
          <div className="px-6 lg:px-10 py-4 flex items-center gap-4 flex-wrap">
            <div className="lg:hidden flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Grape className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Sogrape</div>
                <div className="font-serif text-sm">{project.company_name}</div>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                {project.industry || "Wine & Spirits"} · {project.fiscal_year || "—"}
              </div>
              <h1 className="font-serif text-2xl leading-tight">{project.company_name} · Scorecard</h1>
            </div>

            <div className="ml-auto flex items-center gap-2 flex-wrap">
              {projects.length > 1 && (
                <Select value={currentProjectId || ""} onValueChange={(v) => loadProject(v)}>
                  <SelectTrigger className="w-56 h-9" data-testid={DASH.projectSwitcher}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.company_name}{p.fiscal_year ? ` · ${p.fiscal_year}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Button variant="ghost" onClick={() => setAiOpen(true)} data-testid={DASH.aiSummary}>
                <Sparkles className="h-4 w-4 mr-1.5 text-sogrape-gold" /> Analyze
              </Button>
              <Button variant="outline" onClick={() => navigate("/setup")}>
                <Plus className="h-4 w-4 mr-1.5" /> New
              </Button>
              {showScorecardTools && (
                <>
                  <Button variant="outline" onClick={() => setImportOpen(true)} data-testid={DASH.bulkImport}>
                    <Upload className="h-4 w-4 mr-1.5" /> Bulk import
                  </Button>
                  <Button
                    onClick={() => setObjDialog({ open: true, objective: null, defaultPerspective: filters.perspective_id, defaultDepartment: filters.department_id })}
                    data-testid={DASH.addObjective}
                  >
                    <Plus className="h-4 w-4 mr-1.5" /> Objective
                  </Button>
                </>
              )}
              <ThemeToggle />
            </div>
          </div>

          {/* Section tabs */}
          <div className="px-6 lg:px-10 pb-3 flex items-center gap-3 flex-wrap">
            <Tabs value={section} onValueChange={setSection}>
              <TabsList data-testid="section-tabs">
                <TabsTrigger value="scorecard" data-testid={SECTION.scorecard}><ClipboardList className="h-3.5 w-3.5 mr-1.5" /> Scorecard</TabsTrigger>
                <TabsTrigger value="dashboard" data-testid={SECTION.dashboard}><BarChart3 className="h-3.5 w-3.5 mr-1.5" /> Dashboard</TabsTrigger>
                <TabsTrigger value="okrs" data-testid={SECTION.okrs}><Target className="h-3.5 w-3.5 mr-1.5" /> OKRs</TabsTrigger>
                <TabsTrigger value="kpis" data-testid={SECTION.kpis}><Gauge className="h-3.5 w-3.5 mr-1.5" /> KPIs</TabsTrigger>
                <TabsTrigger value="strategy-map" data-testid={SECTION.strategyMap}><Network className="h-3.5 w-3.5 mr-1.5" /> Strategy Map</TabsTrigger>
                <TabsTrigger value="alignment" data-testid={SECTION.alignment}><Layers className="h-3.5 w-3.5 mr-1.5" /> Alignment</TabsTrigger>
                <TabsTrigger value="initiatives" data-testid={SECTION.initiatives}><Rocket className="h-3.5 w-3.5 mr-1.5" /> Initiatives</TabsTrigger>
                <TabsTrigger value="reports" data-testid={SECTION.reports}><FileText className="h-3.5 w-3.5 mr-1.5" /> Reports</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
              <span>Overall</span>
              <div className="font-serif text-lg text-foreground tabular-nums" data-testid="header-overall">{fmtPct(overall)}</div>
              <PerformanceBadge pct={overall} rating={overallRating(project)} thresholds={project.performance_thresholds} showLabel={false} />
            </div>
          </div>

          {/* Scorecard sub-view toggle */}
          {section === "scorecard" && (
            <div className="px-6 lg:px-10 pb-3">
              <Tabs value={view} onValueChange={setView}>
                <TabsList data-testid="view-tabs">
                  <TabsTrigger value="perspective" data-testid="view-tab-perspective">By Perspective</TabsTrigger>
                  <TabsTrigger value="department" data-testid="view-tab-department">By Department</TabsTrigger>
                  <TabsTrigger value="period" data-testid="view-tab-period">By Time Period</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="px-6 lg:px-10 py-8 max-w-[1500px]">
            {section === "scorecard" && (
              <ScorecardSection
                project={project}
                filters={filters}
                setFilters={setFilters}
                objectivesFiltered={objectivesFiltered}
                view={view}
                overall={overall}
                totalPWeight={totalPWeight}
                setObjDialog={setObjDialog}
                setMeasureDialog={setMeasureDialog}
                setImportOpen={setImportOpen}
              />
            )}

            <Suspense fallback={<SectionFallback />}>
              {section === "dashboard" && (
                <DashboardChartsView filters={filters} setFilters={setFilters} />
              )}

              {section === "okrs" && <OkrsView />}
              {section === "kpis" && <KpisView />}
              {section === "strategy-map" && <StrategyMapView />}
              {section === "alignment" && <AlignmentView />}
              {section === "initiatives" && (
                <InitiativesView filters={filters} setFilters={setFilters} />
              )}
              {section === "reports" && <ReportsView />}
            </Suspense>
          </div>
        </main>
      </div>

      <ObjectiveDialog
        open={objDialog.open}
        onOpenChange={(v) => setObjDialog((s) => ({ ...s, open: v }))}
        objective={objDialog.objective}
        defaultPerspective={objDialog.defaultPerspective}
        defaultDepartment={objDialog.defaultDepartment}
      />
      <MeasureDialog
        open={measureDialog.open}
        onOpenChange={(v) => setMeasureDialog((s) => ({ ...s, open: v }))}
        measure={measureDialog.measure}
        defaultObjective={measureDialog.defaultObjective}
      />
      <BulkImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <DepartmentDialog
        open={deptDialog.open}
        onOpenChange={(v) => setDeptDialog((s) => ({ ...s, open: v }))}
        initial={deptDialog.initial}
        onSubmit={deptDialog.initial ? editDept : addDept}
      />
      <AiSummaryDialog open={aiOpen} onOpenChange={setAiOpen} />
    </div>
  );
};

const ScorecardSection = ({ project, filters, setFilters, objectivesFiltered, view, overall, totalPWeight, setObjDialog, setMeasureDialog, setImportOpen }) => {
  return (
    <>
      <FilterBar filters={filters} setFilters={setFilters} />

      {/* Perspective KPI cards */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8 stagger mt-2"
      >
        {PERSPECTIVES.map((p) => {
          const s = perspectiveScore(p.id, project.objectives, project.measures, project.targets);
          const cnt = project.objectives.filter((o) => o.perspective_id === p.id).length;
          const oWeightSum = perspectiveObjectiveWeightSum(p.id, project.objectives);
          const pw = Number(project.perspective_weights?.[p.id]) || 0;
          return (
            <Card
              key={p.id}
              className="p-5 relative overflow-hidden hover:-translate-y-0.5 transition-transform cursor-pointer"
              role="button"
              tabIndex={0}
              onClick={() => setFilters((f) => ({ ...f, perspective_id: f.perspective_id === p.id ? null : p.id }))}
              data-testid={`perspective-card-${p.id}`}
            >
              <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{p.short}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <div className="font-serif text-3xl tabular-nums">{fmtPct(s, 0)}</div>
                <PerformanceBadge pct={s} rating={perspectiveRating(p.id, project.objectives, project.measures, project.targets, project.performance_thresholds)} thresholds={project.performance_thresholds} showLabel={false} />
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {cnt} objective{cnt === 1 ? "" : "s"} · weight {pw}%
              </div>
              {cnt > 0 && Math.abs(oWeightSum - 100) > 0.5 && (
                <div className="mt-1 text-[11px] text-rag-amber">Objectives sum to {oWeightSum.toFixed(1)}%</div>
              )}
              {filters.perspective_id === p.id && (
                <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-sogrape-gold" />
              )}
            </Card>
          );
        })}
      </motion.div>

      {Math.abs(totalPWeight - 100) > 0.5 && (
        <div className="mb-4 rounded-lg border border-rag-amber/40 bg-rag-amber/5 px-4 py-3 text-sm">
          <b className="rag-amber">Perspective weights sum to {totalPWeight.toFixed(1)}%.</b>{" "}
          <span className="text-muted-foreground">They should total 100%. Adjust in Settings.</span>
        </div>
      )}

      {view === "perspective" && (
        <PerspectiveView
          objectives={objectivesFiltered}
          project={project}
          onEdit={(o) => setObjDialog({ open: true, objective: o })}
          onAddMeasure={(oid) => setMeasureDialog({ open: true, measure: null, defaultObjective: oid })}
          onEditMeasure={(m) => setMeasureDialog({ open: true, measure: m, defaultObjective: m.objective_id })}
        />
      )}
      {view === "department" && (
        <DepartmentView
          objectives={objectivesFiltered}
          project={project}
          onEdit={(o) => setObjDialog({ open: true, objective: o })}
          onAddMeasure={(oid) => setMeasureDialog({ open: true, measure: null, defaultObjective: oid })}
          onEditMeasure={(m) => setMeasureDialog({ open: true, measure: m, defaultObjective: m.objective_id })}
        />
      )}
      {view === "period" && <PeriodView project={project} />}

      {objectivesFiltered.length === 0 && view !== "period" && (
        <Card className="p-14 text-center border-dashed">
          <Sparkles className="h-6 w-6 mx-auto text-muted-foreground" />
          <h3 className="mt-3 font-serif text-2xl">Time for the first objective</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Add an objective in any perspective, or bulk-upload the whole scorecard from Excel.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={() => setObjDialog({ open: true, objective: null, defaultPerspective: filters.perspective_id })}>
              <Plus className="h-4 w-4 mr-1.5" /> Add objective
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-1.5" /> Bulk import
            </Button>
          </div>
        </Card>
      )}
    </>
  );
};

const PerspectiveView = ({ objectives, project, onEdit, onAddMeasure, onEditMeasure }) => {
  const groups = PERSPECTIVES.map((p) => ({ p, items: objectives.filter((o) => o.perspective_id === p.id) })).filter((g) => g.items.length > 0);
  return (
    <div className="space-y-10">
      {groups.map(({ p, items }) => (
        <section key={p.id} data-testid={`perspective-group-${p.id}`}>
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Perspective</div>
              <h2 className="font-serif text-3xl">{p.name}</h2>
            </div>
            <Badge variant="outline">{items.length} objective{items.length === 1 ? "" : "s"}</Badge>
          </div>
          <div className="space-y-4">
            {items.map((o) => (
              <ObjectiveCard key={o.id} objective={o} onEdit={onEdit} onAddMeasure={onAddMeasure} onEditMeasure={onEditMeasure} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

const DepartmentView = ({ objectives, project, onEdit, onAddMeasure, onEditMeasure }) => {
  const groups = [
    ...project.departments.map((d) => ({ key: d.id, title: d.name, items: objectives.filter((o) => o.department_id === d.id) })),
    { key: "unassigned", title: "Unassigned", items: objectives.filter((o) => !o.department_id) },
  ].filter((g) => g.items.length > 0);
  return (
    <div className="space-y-10">
      {groups.map((g) => (
        <section key={g.key} data-testid={`department-group-${g.key}`}>
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Department</div>
              <h2 className="font-serif text-3xl">{g.title}</h2>
            </div>
            <Badge variant="outline">{g.items.length} objective{g.items.length === 1 ? "" : "s"}</Badge>
          </div>
          <div className="space-y-4">
            {g.items.map((o) => (
              <ObjectiveCard key={o.id} objective={o} onEdit={onEdit} onAddMeasure={onAddMeasure} onEditMeasure={onEditMeasure} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

const PeriodView = ({ project }) => {
  const periodMap = {};
  for (const t of project.targets) {
    const m = project.measures.find((x) => x.id === t.measure_id);
    if (!m) continue;
    const bucket = m.time_period === "Quarterly" ? "Quarterly" : "Annual";
    const key = `${bucket}::${t.period}`;
    periodMap[key] = periodMap[key] || { bucket, period: t.period, rows: [] };
    const obj = project.objectives.find((o) => o.id === m.objective_id);
    const persp = PERSPECTIVE_MAP[obj?.perspective_id];
    const pct = (Number(t.actual_value) || 0) / ((Number(t.target_value) || 0) || 1) * 100;
    periodMap[key].rows.push({ measure: m.name, obj: obj?.name || "—", persp: persp?.short || "—", target: t.target_value, actual: t.actual_value, pct });
  }
  const buckets = { Annual: [], Quarterly: [] };
  Object.values(periodMap).forEach((v) => buckets[v.bucket].push(v));
  buckets.Annual.sort((a, b) => a.period.localeCompare(b.period));
  buckets.Quarterly.sort((a, b) => a.period.localeCompare(b.period));
  const has = buckets.Annual.length + buckets.Quarterly.length;

  if (!has) {
    return (
      <Card className="p-14 text-center border-dashed">
        <h3 className="font-serif text-2xl">No period data yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">Add targets and actuals to measures to see period trends.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-10">
      {["Annual", "Quarterly"].map((b) =>
        buckets[b].length ? (
          <section key={b}>
            <div className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground mb-1">Time Period</div>
            <h2 className="font-serif text-3xl mb-4">{b}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {buckets[b].map((pg) => {
                const avg = pg.rows.reduce((a, r) => a + r.pct, 0) / (pg.rows.length || 1);
                return (
                  <Card key={pg.period} className="p-5" data-testid={`period-card-${pg.period}`}>
                    <div className="flex items-baseline justify-between">
                      <div className="font-serif text-2xl">{pg.period}</div>
                      {/* Average across a time period, not a parent of these measures — percentage band is correct. */}
                      <PerformanceBadge pct={avg} thresholds={project.performance_thresholds} />
                    </div>
                    <div className="mt-4 space-y-2">
                      {pg.rows.slice(0, 5).map((r, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="truncate">
                            <div className="font-medium truncate">{r.measure}</div>
                            <div className="text-muted-foreground truncate">{r.obj} · {r.persp}</div>
                          </div>
                          <div className="tabular-nums text-right">
                            {r.actual} / {r.target}
                            <div className="text-[10px] text-muted-foreground">{r.pct.toFixed(1)}%</div>
                          </div>
                        </div>
                      ))}
                      {pg.rows.length > 5 && (
                        <div className="text-[11px] text-muted-foreground">+ {pg.rows.length - 5} more</div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        ) : null
      )}
    </div>
  );
};

export default ScorecardPage;
