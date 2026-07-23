// Export utilities: CSV / Excel / PDF / JSON / Print
import { PLAN_STATEMENTS, CHARACTER_TRAITS, STRATEGIC_THEMES, STRATEGIC_RESULTS } from "./strategicPlan";
import { saveAs } from "file-saver";
import { PERSPECTIVES, PERSPECTIVE_MAP } from "./constants";
import {
  overallScore, perspectiveScore, objectiveScore, measureAchievement,
  measureWeightedScore, measureRating, rating,
} from "./calculations";

// xlsx, jspdf and html2canvas together are roughly half the bundle and none of
// them are needed until the user clicks an export button, so each is loaded on
// demand. JSON export and Print stay synchronous — they need no library.
const loadXLSX = () => import("xlsx");
const loadPDFDeps = async () => {
  const [pdfMod, h2cMod] = await Promise.all([import("jspdf"), import("html2canvas")]);
  return { jsPDF: pdfMod.jsPDF || pdfMod.default, html2canvas: h2cMod.default || h2cMod };
};

const stamp = () => new Date().toISOString().slice(0, 10);

/** Build a flat set of report rows for Excel/CSV — one row per Measure */
export const buildFlatRows = (project) => {
  const rows = [];
  for (const o of project.objectives) {
    const dept = project.departments.find((d) => d.id === o.department_id)?.name || "";
    const persp = PERSPECTIVE_MAP[o.perspective_id]?.name || "";
    const oScore = objectiveScore(o, project.measures, project.targets);
    const measures = project.measures.filter((m) => m.objective_id === o.id);
    if (measures.length === 0) {
      rows.push({
        Perspective: persp, Department: dept, Objective: o.name, ObjectiveOwner: o.owner,
        ObjectiveWeight: o.weight, ObjectiveScore: oScore.toFixed(1),
        Measure: "", MeasureWeight: "", Unit: "", TimePeriod: "",
        Baseline: "", Stretch: "", Achievement: "", WeightedScore: "", Rating: "",
        Period: "", Target: "", Actual: "",
      });
      continue;
    }
    for (const m of measures) {
      const mPct = measureAchievement(m, project.targets);
      const ws = measureWeightedScore(m, project.targets);
      const targets = project.targets.filter((t) => t.measure_id === m.id);
      if (targets.length === 0) {
        rows.push({
          Perspective: persp, Department: dept, Objective: o.name, ObjectiveOwner: o.owner,
          ObjectiveWeight: o.weight, ObjectiveScore: oScore.toFixed(1),
          Measure: m.name, MeasureWeight: m.weight, Unit: m.unit, TimePeriod: m.time_period,
          Baseline: m.baseline, Stretch: m.stretch_target,
          Achievement: mPct.toFixed(1), WeightedScore: ws.toFixed(1), Rating: measureRating(m, project.targets, project.performance_thresholds),
          Period: "", Target: "", Actual: "",
        });
      } else {
        for (const t of targets) {
          const pct = ((Number(t.actual_value) || 0) / (Number(t.target_value) || 1)) * 100;
          rows.push({
            Perspective: persp, Department: dept, Objective: o.name, ObjectiveOwner: o.owner,
            ObjectiveWeight: o.weight, ObjectiveScore: oScore.toFixed(1),
            Measure: m.name, MeasureWeight: m.weight, Unit: m.unit, TimePeriod: m.time_period,
            Baseline: m.baseline, Stretch: m.stretch_target,
            Achievement: mPct.toFixed(1), WeightedScore: ws.toFixed(1), Rating: measureRating(m, project.targets, project.performance_thresholds),
            Period: t.period, Target: t.target_value, Actual: t.actual_value,
          });
        }
      }
    }
  }
  return rows;
};

export const exportCSV = async (project) => {
  const XLSX = await loadXLSX();
  const rows = buildFlatRows(project);
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  saveAs(blob, `sogrape-scorecard-${stamp()}.csv`);
};

export const exportExcel = async (project) => {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  // Overview
  const overview = [
    ["Company", project.company_name],
    ["Industry", project.industry],
    ["Fiscal Year", project.fiscal_year],
    ["Business Unit", project.business_unit],
    ...PLAN_STATEMENTS.map(([label, value]) => [label, value]),
    ["Character", CHARACTER_TRAITS.join(", ")],
    ...STRATEGIC_THEMES.map((t, i) => [
      i === 0 ? "Strategic Themes" : "",
      `${t.name} (${t.tag})`,
    ]),
    ...STRATEGIC_RESULTS.map((r, i) => [i === 0 ? "Strategic Results" : "", r]),
    ["Prepared By", project.prepared_by],
    ["Prepared Date", project.prepared_date],
    [],
    ["Overall balanced score", overallScore(project).toFixed(1)],
    ...PERSPECTIVES.map((p) => [
      `${p.name} score`,
      perspectiveScore(p.id, project.objectives, project.measures, project.targets).toFixed(1),
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overview), "Overview");
  // Flat data
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildFlatRows(project)), "Scorecard");
  // Initiatives
  const inits = project.initiatives.map((i) => ({
    Name: i.name, Owner: i.owner, Status: i.status, Risk: i.risk_level,
    Progress: `${i.progress || 0}%`, Budget: i.budget, Start: i.start_date, End: i.end_date,
    ExpectedImpact: i.expected_impact, Dependencies: i.dependencies,
    LinkedMeasures: (i.measure_ids || []).map((id) => project.measures.find((m) => m.id === id)?.name).filter(Boolean).join("; "),
  }));
  if (inits.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inits), "Initiatives");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), `sogrape-scorecard-${stamp()}.xlsx`);
};

export const exportJSON = (project) => {
  const clone = { ...project };
  delete clone._id;
  const blob = new Blob([JSON.stringify(clone, null, 2)], { type: "application/json" });
  saveAs(blob, `sogrape-scorecard-${(project.company_name || "project").toLowerCase().replace(/\s+/g, "-")}-${stamp()}.json`);
};

export const parseJSONFile = async (file) => {
  const text = await file.text();
  return JSON.parse(text);
};

/** Print — opens native print dialog after prepping the .printable body class */
export const printReport = () => {
  document.body.classList.add("print-active");
  window.print();
  setTimeout(() => document.body.classList.remove("print-active"), 500);
};

/** PDF via html2canvas + jsPDF from a target element (by id). */
export const exportPDF = async (elementId, filename = `sogrape-scorecard-${stamp()}.pdf`) => {
  const el = document.getElementById(elementId);
  if (!el) throw new Error("Element not found");
  const { jsPDF, html2canvas } = await loadPDFDeps();
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: getComputedStyle(document.body).backgroundColor });
  const img = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const imgW = pw - 40;
  const imgH = (canvas.height * imgW) / canvas.width;
  let hLeft = imgH;
  let y = 20;
  pdf.addImage(img, "JPEG", 20, y, imgW, imgH);
  hLeft -= (ph - 20);
  while (hLeft > 0) {
    pdf.addPage();
    y = 20 - (imgH - hLeft);
    pdf.addImage(img, "JPEG", 20, y, imgW, imgH);
    hLeft -= (ph - 20);
  }
  pdf.save(filename);
};
