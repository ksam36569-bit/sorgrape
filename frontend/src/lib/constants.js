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
export const TIME_PERIOD_OPTIONS = ["Annual", "Quarterly"];
export const RISK_OPTIONS = ["Low", "Medium", "High"];

export const quarterPeriods = (fy) => {
  const suffix = fy ? ` ${fy}` : "";
  return [`Q1${suffix}`.trim(), `Q2${suffix}`.trim(), `Q3${suffix}`.trim(), `Q4${suffix}`.trim()];
};

export const annualPeriods = (fy) => [fy || "FY"];
