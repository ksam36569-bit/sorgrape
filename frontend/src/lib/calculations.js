// Live formula engine for Sogrape Balanced Scorecard
// All functions are pure — call whenever project data changes.

export const clampNumber = (n) => (Number.isFinite(n) ? n : 0);

/**
 * Achievement %.
 *
 * Direction matters: for a measure where lower is better (debt ratios, lead
 * times, defect counts) the ratio inverts, otherwise beating the target by
 * coming in *under* it would score as underperformance. Net Debt/EBITDA of 4.2
 * against a 3.5 target is 83%, not 120%.
 */
export const achievementPct = (actual, target, direction = "higher") => {
  const a = Number(actual) || 0;
  const t = Number(target) || 0;
  // No target set, or a "≥ 0" style target: anything positive counts as met.
  if (t === 0) return a > 0 ? 100 : 0;
  if (direction === "lower") {
    // Overshooting a lower-is-better target to zero or below is full marks.
    if (a <= 0) return 100;
    return (t / a) * 100;
  }
  return (a / t) * 100;
};

/** Rating from % + thresholds (defaults: <70 red, 70-89 amber, >=90 green) */
export const rating = (pct, thresholds = { red_max: 70, amber_max: 90 }) => {
  const p = Number(pct) || 0;
  if (p < thresholds.red_max) return "red";
  if (p < thresholds.amber_max) return "amber";
  return "green";
};

/**
 * Latest reported actual for a measure — the value RAG thresholds are read against.
 * Periods sort lexically, which is right for FY25 / Q1-Q4 style labels.
 */
export const latestActual = (measure, targets) => {
  const ms = targets
    .filter((t) => t.measure_id === measure.id)
    .sort((a, b) => String(a.period).localeCompare(String(b.period)));
  return ms.length ? Number(ms[ms.length - 1].actual_value) || 0 : null;
};

/**
 * RAG status for a measure.
 *
 * Two models, in priority order:
 *
 * 1. Explicit per-measure thresholds compared against the raw reported value.
 *    This is how a real scorecard is defined — "green at 15% distribution,
 *    amber at 5%" — and it is what the source workbook specifies.
 * 2. Otherwise fall back to banding the achievement percentage, which is what
 *    measures created in the app do when no thresholds are given.
 *
 * The two disagree more often than you would expect. 8% against a 20% target is
 * 40% achievement, which the default band calls red, but a scorecard whose amber
 * threshold is 5% calls it amber. When thresholds exist, they win.
 */
export const measureRating = (measure, targets, thresholds) => {
  const green = measure?.green_threshold;
  const amber = measure?.amber_threshold;
  const hasThresholds = green !== null && green !== undefined && green !== "" &&
                        amber !== null && amber !== undefined && amber !== "";

  if (hasThresholds) {
    const actual = latestActual(measure, targets);
    if (actual === null) return "red";
    const g = Number(green);
    const a = Number(amber);
    if (measure.direction === "lower") {
      if (actual <= g) return "green";
      if (actual <= a) return "amber";
      return "red";
    }
    if (actual >= g) return "green";
    if (actual >= a) return "amber";
    return "red";
  }

  return rating(measureAchievement(measure, targets), thresholds);
};

const RAG_ORDER = { green: 0, amber: 1, red: 2 };

/** The worst status in a list — an "on target" parent cannot hide an "off track" child. */
const worstRating = (ratings, fallback = "red") =>
  ratings.length
    ? ratings.reduce((worst, r) => (RAG_ORDER[r] > RAG_ORDER[worst] ? r : worst), "green")
    : fallback;

/**
 * RAG status for an objective: the worst status among its measures.
 *
 * Deliberately NOT a band on the weighted score. Those two disagree, and when
 * they do the score is the misleading one — a weighted average lets a strong
 * measure mask a failing one, so an objective could show green while something
 * underneath it was amber. Weights still drive the numeric score; they just no
 * longer decide the colour.
 */
export const objectiveRating = (objective, measures, targets, thresholds) => {
  const oms = measures.filter((m) => m.objective_id === objective.id);
  if (!oms.length) return rating(0, thresholds);
  return worstRating(oms.map((m) => measureRating(m, targets, thresholds)));
};

/** RAG status for a perspective: the worst status among its objectives. */
export const perspectiveRating = (perspectiveId, objectives, measures, targets, thresholds) => {
  const objs = objectives.filter((o) => o.perspective_id === perspectiveId);
  if (!objs.length) return rating(0, thresholds);
  return worstRating(objs.map((o) => objectiveRating(o, measures, targets, thresholds)));
};

/** RAG status for the whole scorecard: the worst status among its perspectives. */
export const overallRating = (project, perspectiveIds) => {
  const ids = perspectiveIds || ["financial", "customer", "internal", "learning"];
  return worstRating(
    ids.map((id) =>
      perspectiveRating(id, project.objectives, project.measures, project.targets, project.performance_thresholds)
    )
  );
};

/** Aggregate a measure across its targets — average of achievement % across periods (with targets) */
export const measureAchievement = (measure, targets) => {
  const ms = targets.filter((t) => t.measure_id === measure.id);
  if (ms.length === 0) return 0;
  const sum = ms.reduce(
    (acc, t) => acc + achievementPct(t.actual_value, t.target_value, measure.direction),
    0
  );
  return sum / ms.length;
};

/** Weighted Score per Measure = achievement% × weight/100 */
export const measureWeightedScore = (measure, targets) =>
  (measureAchievement(measure, targets) * (Number(measure.weight) || 0)) / 100;

/** Objective score = sum of its measures' weighted scores (accurate once measure weights sum to 100%) */
export const objectiveScore = (objective, measures, targets) => {
  const oms = measures.filter((m) => m.objective_id === objective.id);
  if (oms.length === 0) return 0;
  return oms.reduce((acc, m) => acc + measureWeightedScore(m, targets), 0);
};

/** Perspective score = sum of (objective score × objective weight/100) */
export const perspectiveScore = (perspectiveId, objectives, measures, targets) => {
  const objs = objectives.filter((o) => o.perspective_id === perspectiveId);
  if (objs.length === 0) return 0;
  return objs.reduce(
    (acc, o) => acc + (objectiveScore(o, measures, targets) * (Number(o.weight) || 0)) / 100,
    0
  );
};

/** Overall organizational score */
export const overallScore = (project) => {
  const { objectives = [], measures = [], targets = [], perspective_weights = {} } = project || {};
  const ids = ["financial", "customer", "internal", "learning"];
  return ids.reduce((acc, pid) => {
    const w = Number(perspective_weights[pid]) || 0;
    return acc + (perspectiveScore(pid, objectives, measures, targets) * w) / 100;
  }, 0);
};

/** Sum of measure weights inside an objective */
export const objectiveMeasureWeightSum = (objectiveId, measures) =>
  measures.filter((m) => m.objective_id === objectiveId).reduce((a, m) => a + (Number(m.weight) || 0), 0);

/** Sum of objective weights inside a perspective */
export const perspectiveObjectiveWeightSum = (perspectiveId, objectives) =>
  objectives.filter((o) => o.perspective_id === perspectiveId).reduce((a, o) => a + (Number(o.weight) || 0), 0);

/** Sum of perspective weights (should be 100) */
export const totalPerspectiveWeight = (project) => {
  const w = project?.perspective_weights || {};
  return (Number(w.financial) || 0) + (Number(w.customer) || 0) + (Number(w.internal) || 0) + (Number(w.learning) || 0);
};

/** Variance = actual - target ; Gap = target - actual */
export const variance = (actual, target) => (Number(actual) || 0) - (Number(target) || 0);
export const gap = (actual, target) => (Number(target) || 0) - (Number(actual) || 0);

/** Contribution % of a measure to its objective's total weighted score */
export const measureContributionPct = (measure, measures, targets) => {
  const oms = measures.filter((m) => m.objective_id === measure.objective_id);
  const total = oms.reduce((a, m) => a + measureWeightedScore(m, targets), 0);
  if (total === 0) return 0;
  return (measureWeightedScore(measure, targets) / total) * 100;
};

/** Format helpers */
export const fmtPct = (n, digits = 1) => `${(Number(n) || 0).toFixed(digits)}%`;
export const fmtNum = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString() : "—");
