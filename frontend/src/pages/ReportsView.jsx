import { BrandLogo } from "../components/BrandLogo";
import React, { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useScorecard } from "../context/ScorecardContext";
import { PERSPECTIVES, PERSPECTIVE_MAP } from "../lib/constants";
import {
  overallScore, perspectiveScore, objectiveScore, measureAchievement, measureRating, fmtPct, rating, perspectiveRating, overallRating,
} from "../lib/calculations";
import { exportCSV, exportExcel, exportJSON, exportPDF, printReport, parseJSONFile } from "../lib/reports";
import { api } from "../lib/api";
import PerformanceBadge from "../components/PerformanceBadge";
import { toast } from "sonner";
import { FileDown, Printer, FileText, Table as TableIcon, FileJson, Upload, FileSpreadsheet, Wand2 } from "lucide-react";
import { downloadActualsTemplate, parseWorkbook } from "../lib/excel";
import { DASH } from "../constants/testIds";

const ReportsView = () => {
  const { project, refreshProject, refreshProjects, loadProject } = useScorecard();
  const [busyPdf, setBusyPdf] = useState(false);
  const reportRef = useRef(null);
  const jsonInputRef = useRef(null);
  const actualsInputRef = useRef(null);

  const overall = overallScore(project);

  const onImportJson = async (file) => {
    if (!file) return;
    try {
      const payload = await parseJSONFile(file);
      const p = await api.importProject(payload);
      await refreshProjects();
      await loadProject(p.id);
      toast.success(`Imported "${p.company_name}"`);
    } catch (e) {
      toast.error("JSON import failed — check file format");
    }
  };

  const onImportActuals = async (file) => {
    if (!file) return;
    try {
      const sheets = await parseWorkbook(file);
      // Take first non-empty sheet
      const sheetName = Object.keys(sheets).find((n) => (sheets[n] || []).length > 0);
      if (!sheetName) throw new Error("No rows found");
      const rows = sheets[sheetName].map((r) => ({
        measure: r.measure ?? r.Measure ?? r.name,
        period: r.period ?? r.Period,
        actual_value: r.actual_value ?? r.actual ?? r.Actual ?? r.value ?? 0,
      })).filter((r) => r.measure && r.period);
      if (rows.length === 0) throw new Error("No usable rows");
      const res = await api.updateActuals(project.id, rows);
      await refreshProject();
      toast.success(`Actuals: updated ${res.updated}, created ${res.created}`);
    } catch (e) {
      toast.error("Actuals import failed — check file & headers");
    }
  };

  // Export libraries load on demand now, so a click can fail on a flaky network
  // or a stale chunk after a redeploy. Without this the rejection is silent.
  const runExport = (label, fn) => async () => {
    try {
      await fn();
    } catch (e) {
      toast.error(`${label} failed — check your connection and try again`);
    }
  };

  const doPdf = async () => {
    setBusyPdf(true);
    try {
      await exportPDF("report-print-area", `sogrape-${(project.company_name || "").toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF exported");
    } catch (e) {
      toast.error("PDF export failed");
    } finally { setBusyPdf(false); }
  };

  return (
    <div className="space-y-4" data-testid="reports-view">
      {/* Export toolbar */}
      <Card className="p-5">
        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Reports & Export</div>
        <h2 className="font-serif text-2xl mt-1">Share the scorecard</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Download the executive report, the detailed data, or take a full backup of this project.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={doPdf} disabled={busyPdf} data-testid="export-pdf-btn">
            <FileText className="h-4 w-4 mr-1.5" /> {busyPdf ? "Preparing PDF…" : "Export PDF"}
          </Button>
          <Button variant="outline" onClick={runExport("Excel export", () => exportExcel(project))} data-testid="export-excel-btn">
            <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Export Excel
          </Button>
          <Button variant="outline" onClick={runExport("CSV export", () => exportCSV(project))} data-testid="export-csv-btn">
            <TableIcon className="h-4 w-4 mr-1.5" /> Export CSV
          </Button>
          <Button variant="outline" onClick={() => printReport()} data-testid="print-btn">
            <Printer className="h-4 w-4 mr-1.5" /> Print
          </Button>
          <div className="mx-2 h-8 border-l border-border" />
          <Button variant="outline" onClick={runExport("JSON export", () => exportJSON(project))} data-testid={DASH.exportJson}>
            <FileJson className="h-4 w-4 mr-1.5" /> Export JSON (backup)
          </Button>
          <input ref={jsonInputRef} type="file" accept=".json" hidden onChange={(e) => onImportJson(e.target.files?.[0])} />
          <Button variant="outline" onClick={() => jsonInputRef.current?.click()} data-testid={DASH.importJson}>
            <Upload className="h-4 w-4 mr-1.5" /> Import JSON
          </Button>
        </div>

        <div className="mt-5 pt-5 border-t border-border">
          <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Update actuals — quick mode</div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            For recurring refreshes: upload a small file with just measure name + period + actual value.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input ref={actualsInputRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => onImportActuals(e.target.files?.[0])} />
            <Button variant="outline" onClick={() => actualsInputRef.current?.click()} data-testid={DASH.updateActuals}>
              <Wand2 className="h-4 w-4 mr-1.5" /> Update actuals
            </Button>
            <Button variant="ghost" onClick={runExport("Template download", downloadActualsTemplate)}>
              <FileDown className="h-4 w-4 mr-1.5" /> Download actuals template
            </Button>
          </div>
        </div>
      </Card>

      {/* Printable report */}
      <div id="report-print-area" ref={reportRef} className="bg-card border border-border rounded-lg p-8 space-y-6 print-report">
        <header className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-4">
            <BrandLogo height={52} />
            <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Sogrape · Balanced Scorecard</div>
            <h1 className="font-serif text-3xl">{project.company_name}</h1>
            <div className="text-sm text-muted-foreground">
              {project.industry || "—"} · {project.fiscal_year || "—"} · {project.business_unit || "—"} · Prepared by {project.prepared_by || "—"} · {project.prepared_date || ""}
            </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall</div>
            <div className="font-serif text-4xl tabular-nums">{fmtPct(overall)}</div>
            <PerformanceBadge pct={overall} rating={overallRating(project)} thresholds={project.performance_thresholds} />
          </div>
        </header>

        {project.vision && (
          <section>
            <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Vision</div>
            <p className="text-sm mt-1">{project.vision}</p>
          </section>
        )}
        {project.mission && (
          <section>
            <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Mission</div>
            <p className="text-sm mt-1">{project.mission}</p>
          </section>
        )}

        {/* Perspective breakdown */}
        <section>
          <h2 className="font-serif text-2xl mb-3">Perspective scores</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PERSPECTIVES.map((p) => {
              const s = perspectiveScore(p.id, project.objectives, project.measures, project.targets);
              return (
                <div key={p.id} className="border border-border rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{p.short}</div>
                  <div className="font-serif text-2xl mt-1 tabular-nums">{fmtPct(s)}</div>
                  <PerformanceBadge pct={s} rating={perspectiveRating(p.id, project.objectives, project.measures, project.targets, project.performance_thresholds)} thresholds={project.performance_thresholds} showLabel={false} />
                </div>
              );
            })}
          </div>
        </section>

        {/* Objectives with measures */}
        <section>
          <h2 className="font-serif text-2xl mb-3">Objectives & measures</h2>
          <div className="space-y-3">
            {project.objectives.map((o) => {
              const oScore = objectiveScore(o, project.measures, project.targets);
              const persp = PERSPECTIVE_MAP[o.perspective_id];
              const measures = project.measures.filter((m) => m.objective_id === o.id);
              return (
                <div key={o.id} className="border border-border rounded p-3">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{persp?.short}</div>
                      <div className="font-medium">{o.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Score</div>
                      <div className="font-serif text-lg tabular-nums">{fmtPct(oScore)}</div>
                    </div>
                  </div>
                  {measures.length > 0 && (
                    <table className="w-full text-xs mt-3">
                      <thead>
                        <tr className="text-muted-foreground uppercase tracking-wider text-[10px]">
                          <th className="text-left py-1">Measure</th>
                          <th className="text-right py-1">Weight</th>
                          <th className="text-right py-1">Achievement</th>
                          <th className="text-right py-1">Rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        {measures.map((m) => {
                          const pct = measureAchievement(m, project.targets);
                          const rag = measureRating(m, project.targets, project.performance_thresholds);
                          return (
                            <tr key={m.id} className="border-t border-border">
                              <td className="py-1.5 pr-2">{m.name}</td>
                              <td className="py-1.5 text-right tabular-nums">{m.weight || 0}%</td>
                              <td className="py-1.5 text-right tabular-nums">{pct.toFixed(1)}%</td>
                              <td className="py-1.5 text-right capitalize">{rag}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Initiatives */}
        {project.initiatives.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl mb-3">Initiatives</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground uppercase tracking-wider text-[10px]">
                  <th className="text-left py-1">Name</th>
                  <th className="text-left py-1">Owner</th>
                  <th className="text-right py-1">Progress</th>
                  <th className="text-left py-1">Status</th>
                  <th className="text-left py-1">Risk</th>
                </tr>
              </thead>
              <tbody>
                {project.initiatives.map((i) => (
                  <tr key={i.id} className="border-t border-border">
                    <td className="py-1.5 pr-2">{i.name}</td>
                    <td className="py-1.5">{i.owner || "—"}</td>
                    <td className="py-1.5 text-right tabular-nums">{Number(i.progress) || 0}%</td>
                    <td className="py-1.5">{i.status}</td>
                    <td className="py-1.5">{i.risk_level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer className="pt-4 border-t border-border text-[10px] uppercase tracking-[0.28em] text-muted-foreground text-center">
          Sogrape · Balanced Scorecard · Generated {new Date().toLocaleString()}
        </footer>
      </div>
    </div>
  );
};

export default ReportsView;
