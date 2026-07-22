export const PERSPECTIVES = [
  { id: "financial", name: "Financial", short: "Financial" },
  { id: "customer", name: "Customer", short: "Customer" },
  { id: "internal", name: "Internal Business Processes", short: "Internal Process" },
  { id: "learning", name: "Learning & Growth", short: "Learning & Growth" },
];

export const PERSPECTIVE_MAP = Object.fromEntries(PERSPECTIVES.map((p) => [p.id, p]));

export const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Critical"];
export const STATUS_OPTIONS = ["On Track", "At Risk", "Off Track", "Complete"];
export const UNIT_OPTIONS = ["%", "Revenue", "Cost", "Time", "Rating", "Count", "Ratio", "Score"];
// Stored values stay "Annual"/"Quarterly" -- the zod enum, the bulk importer and
// every existing row depend on them. Only the wording shown in the dropdown
// changes.
export const TIME_PERIOD_OPTIONS = ["Annual", "Quarterly"];
export const TIME_PERIOD_LABELS = { Annual: "Annually", Quarterly: "Quarterly" };
export const RISK_OPTIONS = ["Low", "Medium", "High"];

export const quarterPeriods = (fy) => {
  const suffix = fy ? ` ${fy}` : "";
  return [`Q1${suffix}`.trim(), `Q2${suffix}`.trim(), `Q3${suffix}`.trim(), `Q4${suffix}`.trim()];
};

export const annualPeriods = (fy) => [fy || "FY"];

/** The periods a measure is allowed to report against, given its time_period. */
export const periodsFor = (timePeriod, fy) =>
  timePeriod === "Quarterly" ? quarterPeriods(fy) : annualPeriods(fy);

/** True for a quarter label -- "Q3 FY26", "Q1", "q2 2026". */
export const isQuarterPeriod = (period) => /^\s*Q[1-4]\b/i.test(String(period || ""));

/**
 * Sort key for a period label: [year, quarter, raw].
 *
 * Lexical sorting looks fine inside one year and breaks across two: "Q1 FY26"
 * sorts before "Q4 FY25" because it compares Q1 to Q4 first. Parsing the year
 * out fixes that. The annual roll-up gets quarter 5 so it lands after its own
 * year's quarters, and anything unparseable sorts last rather than landing in
 * the middle of a real timeline.
 */
export const periodSortKey = (period) => {
  const raw = String(period || "").trim();
  const qm = raw.match(/^\s*Q([1-4])\b/i);
  const rest = qm ? raw.slice(qm[0].length) : raw;
  const ym = rest.match(/(\d{2,4})/);
  if (!qm && !ym) return [Infinity, Infinity, raw.toUpperCase()];
  let year = ym ? Number(ym[1]) : 0;
  if (year < 100) year += 2000;
  return [year, qm ? Number(qm[1]) : 5, raw.toUpperCase()];
};

export const comparePeriods = (a, b) => {
  const ka = periodSortKey(a);
  const kb = periodSortKey(b);
  for (let i = 0; i < 3; i += 1) {
    if (ka[i] < kb[i]) return -1;
    if (ka[i] > kb[i]) return 1;
  }
  return 0;
};

/**
 * A target row counts as reported only when someone has entered an actual.
 * actual_value is nullable precisely so "not reported yet" is distinguishable
 * from "reported zero" -- treating the first as a zero would draw a quarter
 * that has not happened yet as a total miss.
 */
export const isReported = (target) =>
  target?.actual_value !== null && target?.actual_value !== undefined && target?.actual_value !== "";
