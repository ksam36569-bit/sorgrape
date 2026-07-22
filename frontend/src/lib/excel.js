// Excel bulk import/export utilities using SheetJS
import { saveAs } from "file-saver";
import { PERSPECTIVES } from "./constants";

// SheetJS is around 400 kB and is only needed when someone actually touches a
// spreadsheet, so it is fetched on demand rather than on first paint. The
// browser caches the chunk, so this costs one short delay per session.
const loadXLSX = () => import("xlsx");

const HEADER_ROWS = {
  Departments: [{ name: "Sales & Distribution" }],
  Objectives: [
    {
      name: "Increase Revenue Growth",
      description: "Grow YoY topline across all channels",
      perspective: "Financial",
      department: "Sales & Distribution",
      priority: "High",
      owner: "CFO",
      timeline: "FY26",
      status: "On Track",
      weight: 40,
    },
  ],
  Measures: [
    {
      name: "Annual Revenue",
      objective: "Increase Revenue Growth",
      unit: "Revenue",
      weight: 60,
      baseline: 100000000,
      stretch_target: 130000000,
      time_period: "Annual",
      owner: "CFO",
      data_source: "ERP",
      description: "Consolidated group revenue",
      comments: "",
    },
  ],
  Targets: [
    {
      measure: "Annual Revenue",
      period: "FY26",
      target_value: 120000000,
      actual_value: 118000000,
    },
  ],
  Initiatives: [
    {
      name: "Launch DTC E-commerce",
      description: "Direct-to-consumer online store",
      measures: "Annual Revenue",
      budget: 500000,
      owner: "Head of Digital",
      start_date: "2025-04-01",
      end_date: "2026-03-31",
      progress: 25,
      status: "On Track",
      risk_level: "Medium",
      expected_impact: "€5M incremental revenue",
      dependencies: "IT platform ready",
    },
  ],
};

const HEADER_LABELS = {
  Departments: ["name"],
  Objectives: [
    "name", "description", "perspective", "department", "priority",
    "owner", "timeline", "status", "weight",
  ],
  Measures: [
    "name", "objective", "unit", "weight", "baseline", "stretch_target",
    "time_period", "direction", "owner", "data_source", "description", "comments",
  ],
  Targets: ["measure", "period", "target_value", "actual_value"],
  Initiatives: [
    "name", "description", "measures", "budget", "owner", "start_date",
    "end_date", "progress", "status", "risk_level", "expected_impact", "dependencies",
  ],
};

export const downloadTemplate = async () => {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  for (const sheet of ["Departments", "Objectives", "Measures", "Targets", "Initiatives"]) {
    const headers = HEADER_LABELS[sheet];
    const example = HEADER_ROWS[sheet][0];
    const rows = [headers, headers.map((h) => example[h] ?? "")];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheet);
  }
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), "sogrape-scorecard-template.xlsx");
};

export const downloadActualsTemplate = async () => {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  const headers = ["measure", "period", "actual_value"];
  const example = [["Annual Revenue", "FY26", 118000000]];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...example]);
  XLSX.utils.book_append_sheet(wb, ws, "Actuals");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), "sogrape-actuals-template.xlsx");
};

const cleanNumber = (val) => {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return val;
  const s = String(val).replace(/[€$£¥,\s]/g, "").replace(/%$/, "").trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

const norm = (s) => (s || "").toString().trim().toLowerCase();

const KNOWN_SHEETS = ["Departments", "Objectives", "Measures", "Targets", "Initiatives"];

export const parseWorkbook = async (file) => {
  const XLSX = await loadXLSX();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheets = {};
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
    sheets[name] = rows;
  }
  return sheets;
};

/** Try to guess entity type from sheet name (case-insensitive). */
export const guessEntity = (sheetName) => {
  const n = norm(sheetName);
  for (const k of KNOWN_SHEETS) if (norm(k) === n || n.includes(norm(k)) || norm(k).includes(n)) return k;
  return null;
};

/** Cleans/normalises row values by entity. */
export const normaliseRow = (entity, row) => {
  const out = { ...row };
  if (entity === "Objectives") {
    out.weight = cleanNumber(row.weight);
    // resolve perspective by id or name
    const perspInput = norm(row.perspective);
    const match = PERSPECTIVES.find((p) => norm(p.id) === perspInput || norm(p.name) === perspInput || norm(p.short) === perspInput);
    out.perspective = match?.name || row.perspective;
    out.perspective_id = match?.id;
  } else if (entity === "Measures") {
    out.weight = cleanNumber(row.weight);
    out.baseline = cleanNumber(row.baseline);
    out.stretch_target = cleanNumber(row.stretch_target);
    if (!["Annual", "Quarterly"].includes(row.time_period)) {
      out.time_period = norm(row.time_period).startsWith("q") ? "Quarterly" : "Annual";
    }
    // Accept "Lower Better", "lower", "lower is better" etc; anything else means higher.
    out.direction = norm(row.direction).startsWith("lower") ? "lower" : "higher";
  } else if (entity === "Targets") {
    out.target_value = cleanNumber(row.target_value);
    out.actual_value = cleanNumber(row.actual_value);
    out.period = (row.period || "").toString().trim();
  } else if (entity === "Initiatives") {
    out.budget = cleanNumber(row.budget);
    out.progress = cleanNumber(row.progress);
  }
  return out;
};

export const KNOWN_ENTITIES = KNOWN_SHEETS;
export const HEADERS = HEADER_LABELS;
