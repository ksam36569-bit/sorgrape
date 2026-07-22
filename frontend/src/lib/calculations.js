// Live formula engine for Sogrape Balanced Scorecard
// All functions are pure — call whenever project data changes.

export const clampNumber = (n) => (Number.isFinite(n) ? n : 0);

/** Achievement % = actual / target × 100 (guard divide-by-zero) */
export const achievementPct = (actual, target) => {
  const a = Number(actual) || 0;
  const t = Number(target) || 0;
  if (t === 0) return a === 0 ? 0 : 100; // if no target set, treat 0/0 as 0
  return (a / t) * 100;
};

/** Rating from % + thresholds (defaults: <70 red, 70-89 amber, >=90 green) */
export const rating = (pct, thresholds = { red_max: 70, amber_max: 90 }) => {
  const p = Number(pct) || 0;
  if (p < thresholds.red_max) return "red";
  if (p < thresholds.amber_max) return "amber";
  return "green";
};

/** Aggregate a measure across its targets — average of achievement % across periods (with targets) */
export const measureAchievement = (measure, targets) => {
  const ms = targets.filter((t) => t.measure_id === measure.id);
  if (ms.length === 0) return 0;
  const sum = ms.reduce((acc, t) => acc + achievementPct(t.actual_value, t.target_value), 0);
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
