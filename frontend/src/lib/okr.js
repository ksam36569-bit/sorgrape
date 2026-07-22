// OKR scoring. Pure functions, no React, so the arithmetic is testable on its own.

/**
 * Progress toward a Key Result, as a percentage.
 *
 *   (current - baseline) / (target - baseline)
 *
 * Distance travelled from the baseline, not current/target. That is what makes
 * "grow Iberian share from 59% to 63%" read correctly: sitting at the baseline
 * is 0% done, not 94%.
 *
 * Direction falls out for free — if the target is below the baseline ("cut lead
 * time from 42 to 35") both sides go negative and the ratio stays positive as
 * the number falls.
 *
 * Returns null when target equals baseline, because "how far between two
 * identical numbers" has no answer. Callers render that as "—" rather than
 * inventing 0% or 100%.
 */
export function krProgress(kr) {
  const baseline = Number(kr?.baseline) || 0;
  const target = Number(kr?.target) || 0;
  const current = Number(kr?.current_value) || 0;
  const span = target - baseline;
  if (span === 0) return null;
  return ((current - baseline) / span) * 100;
}

/** Clamped to 0–100 for bar widths; overshoot shows in the number, not the bar. */
export const krProgressClamped = (kr) => {
  const p = krProgress(kr);
  return p === null ? 0 : Math.max(0, Math.min(100, p));
};

/** An OKR's progress is the mean of its Key Results, skipping unscoreable ones. */
export function okrProgress(keyResults = []) {
  const scored = keyResults.map(krProgress).filter((p) => p !== null);
  if (!scored.length) return null;
  return scored.reduce((a, b) => a + b, 0) / scored.length;
}

const clampPct = (n) => Math.max(0, Math.min(100, n));

/** How far through the time window we are, 0–100, or null without a usable due date. */
export function timeElapsedPct(kr, now = new Date()) {
  if (!kr?.due_date) return null;
  const due = new Date(kr.due_date);
  if (Number.isNaN(due.getTime())) return null;
  const start = kr.created_at ? new Date(kr.created_at) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const total = due - start;
  if (total <= 0) return 100;
  return clampPct(((now - start) / total) * 100);
}

/**
 * RAG status for a Key Result.
 *
 * A manual override always wins. Otherwise progress is compared against the pace
 * the deadline implies — 20% done is fine in February and alarming in December,
 * so progress alone would mislead. Without a usable due date it falls back to
 * progress thresholds.
 *
 * The reason is printed next to every bar, so nobody has to guess why something
 * turned amber.
 */
export function krStatus(kr, now = new Date()) {
  if (kr?.status_override) return kr.status_override;
  const progress = krProgress(kr);
  if (progress === null) return "amber";

  const elapsed = timeElapsedPct(kr, now);
  if (elapsed === null) {
    if (progress >= 70) return "green";
    if (progress >= 40) return "amber";
    return "red";
  }
  // Slipping up to 10 points behind pace is normal; 25 behind is off track.
  const gap = elapsed - progress;
  if (gap <= 10) return "green";
  if (gap <= 25) return "amber";
  return "red";
}

/** Plain-language reason for a status, shown in the UI so the rule is not hidden. */
export function krStatusReason(kr, now = new Date()) {
  if (kr?.status_override) return "Set manually";
  const progress = krProgress(kr);
  if (progress === null) return "Target equals baseline — nothing to measure";
  const elapsed = timeElapsedPct(kr, now);
  if (elapsed === null) return `${progress.toFixed(0)}% complete, no due date set`;
  return `${progress.toFixed(0)}% complete against ${elapsed.toFixed(0)}% of the time`;
}

const ORDER = { green: 0, amber: 1, red: 2 };

/** An OKR is only as healthy as its weakest Key Result — same rule as the scorecard. */
export function okrStatus(keyResults = [], now = new Date()) {
  if (!keyResults.length) return "amber";
  return keyResults
    .map((kr) => krStatus(kr, now))
    .reduce((worst, s) => (ORDER[s] > ORDER[worst] ? s : worst), "green");
}

export const STATUS_LABEL = { green: "On track", amber: "At risk", red: "Off track" };
