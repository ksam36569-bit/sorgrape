import React from "react";
import { rating as ratingFn } from "../lib/calculations";
import { cn } from "@/lib/utils";

const LABELS = {
  red: "Off Track",
  amber: "At Risk",
  green: "On Target",
};

const PerformanceBadge = ({ pct, thresholds, className, showLabel = true, testId }) => {
  const r = ratingFn(pct, thresholds);
  const bg = r === "red" ? "bg-rag-red" : r === "amber" ? "bg-rag-amber" : "bg-rag-green";
  return (
    <span
      data-testid={testId || `perf-badge-${r}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        "border-border bg-card",
        className
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", bg)} aria-hidden />
      {showLabel && (
        <span className="tabular-nums">
          {(Number(pct) || 0).toFixed(1)}% · {LABELS[r]}
        </span>
      )}
    </span>
  );
};

export default PerformanceBadge;
