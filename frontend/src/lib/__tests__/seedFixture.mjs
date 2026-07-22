// Rebuilds the scorecard object from the SQL seed that actually ships.
//
// The fixture used to load a committed JSON copy, which meant the test could
// pass while the seed people really run had drifted. Parsing the migration keeps
// the RAG guarantee tied to the data in the database.
import { readFileSync } from "fs";

const sql = readFileSync(new URL("../../../../supabase/migrations/0002_seed_fy25.sql", import.meta.url), "utf8");

/** Split a VALUES tuple on commas that are not inside quotes. */
function splitCells(row) {
  const out = [];
  let cur = "", quoted = false;
  for (let i = 0; i < row.length; i += 1) {
    const c = row[i];
    if (c === "'") {
      if (quoted && row[i + 1] === "'") { cur += "''"; i += 1; continue; }
      quoted = !quoted;
      cur += c;
      continue;
    }
    if (c === "," && !quoted) { out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const unwrap = (cell) => {
  const v = cell.replace(/::\w+(\[\])?$/, "").trim();
  if (v === "null") return null;
  if (v.startsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
};

function table(name) {
  const marker = `insert into public.${name} (`;
  const at = sql.indexOf(marker);
  if (at === -1) return [];
  const cols = sql.slice(at + marker.length, sql.indexOf(")", at)).split(",").map((c) => c.trim());
  const body = sql.slice(sql.indexOf("values", at) + 6, sql.indexOf("on conflict", at));
  const rows = [];
  // Tuples are one per line in the generated seed.
  for (const line of body.split("\n")) {
    const t = line.trim().replace(/,$/, "");
    if (!t.startsWith("(")) continue;
    const cells = splitCells(t.slice(1, -1));
    rows.push(Object.fromEntries(cols.map((c, i) => [c, unwrap(cells[i] ?? "null")])));
  }
  return rows;
}

const project = table("projects")[0] || {};
export default {
  ...project,
  perspective_weights: { financial: 25, customer: 25, internal: 25, learning: 25 },
  performance_thresholds: { red_max: 70, amber_max: 90 },
  objectives: table("objectives"),
  measures: table("measures"),
  targets: table("targets"),
  initiatives: table("initiatives"),
  departments: [],
  strategy_edges: [],
};
