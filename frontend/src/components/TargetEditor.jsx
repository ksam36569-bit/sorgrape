import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useScorecard } from "../context/ScorecardContext";
import PerformanceBadge from "./PerformanceBadge";
import {
  achievementPct, measureAchievement, fmtPct, measureRating,
} from "../lib/calculations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { periodsFor, comparePeriods, TIME_PERIOD_LABELS } from "../lib/constants";
import { Plus, Trash2 } from "lucide-react";

/**
 * Inline editor for a measure's targets.
 * Auto-suggests periods based on measure.time_period + project.fiscal_year.
 */
const TargetEditor = ({ measure }) => {
  const { project, refreshProject } = useScorecard();
  const [busy, setBusy] = useState(false);
  const [newPeriod, setNewPeriod] = useState("");

  const targets = useMemo(
    () => (project?.targets || []).filter((t) => t.measure_id === measure.id).sort((a, b) => comparePeriods(a.period, b.period)),
    [project, measure.id]
  );

  // The periods on offer follow the measure's own time_period: Quarterly gives
  // Q1-Q4 of the fiscal year, Annually gives the single FY row. Picking from a
  // list rather than typing is what keeps every measure on the same labels -- a
  // hand-typed "Q1 25" would silently become its own point on the trend chart.
  const suggestedPeriods = useMemo(
    () => periodsFor(measure.time_period, project?.fiscal_year || ""),
    [measure.time_period, project?.fiscal_year]
  );

  const existing = new Set(targets.map((t) => t.period));
  const available = suggestedPeriods.filter((p) => !existing.has(p));

  const addPeriod = async (period) => {
    if (!period.trim()) return;
    setBusy(true);
    try {
      await api.addTarget(project.id, {
        // actual_value starts null, not 0 -- the period exists but nobody has
        // reported against it yet, and those are different things.
        measure_id: measure.id, period: period.trim(), target_value: 0, actual_value: null,
      });
      await refreshProject();
      setNewPeriod("");
    } catch {
      toast.error("Could not add target");
    } finally {
      setBusy(false);
    }
  };

  const updateField = async (t, field, value) => {
    // Clearing the actual box means "not reported yet", which is a real state
    // and not the same as reporting zero. A blank target still means zero.
    const blank = String(value === null || value === undefined ? "" : value).trim() === "";
    const val = blank ? (field === "actual_value" ? null : 0) : parseFloat(value);
    if (val !== null && (Number.isNaN(val) || val < 0)) {
      toast.error("Targets cannot be negative");
      return;
    }
    try {
      await api.updateTarget(project.id, t.id, { ...t, [field]: val });
      await refreshProject();
    } catch {
      toast.error("Could not update");
    }
  };

  const remove = async (t) => {
    try {
      await api.deleteTarget(project.id, t.id);
      await refreshProject();
    } catch {
      toast.error("Could not delete");
    }
  };

  const avg = measureAchievement(measure, project.targets);

  return (
    <div className="border-t border-border/60 mt-3 pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Targets · {TIME_PERIOD_LABELS[measure.time_period] || measure.time_period}
        </div>
        <PerformanceBadge pct={avg} rating={measureRating(measure, project.targets, project.performance_thresholds)} thresholds={project.performance_thresholds} testId={`measure-achievement-${measure.id}`} />
      </div>

      {targets.length > 0 && (
        <div className="grid grid-cols-12 gap-2 items-center text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
          <div className="col-span-3">Period</div>
          <div className="col-span-3">Target</div>
          <div className="col-span-3">Actual</div>
          <div className="col-span-2 text-right">Achievement</div>
          <div className="col-span-1"></div>
        </div>
      )}

      <div className="space-y-2">
        {targets.map((t) => {
          const pct = achievementPct(t.actual_value, t.target_value, measure?.direction);
          return (
            <div key={t.id} className="grid grid-cols-12 gap-2 items-center" data-testid={`target-row-${t.id}`}>
              <div className="col-span-3 text-sm font-medium">{t.period}</div>
              <Input
                className="col-span-3 h-8"
                type="number" step="0.01" min="0"
                defaultValue={t.target_value}
                onBlur={(e) => updateField(t, "target_value", e.target.value)}
                data-testid={`target-value-${t.id}`}
              />
              <Input
                className="col-span-3 h-8"
                type="number" step="0.01" min="0"
                defaultValue={t.actual_value === null || t.actual_value === undefined ? "" : t.actual_value}
                placeholder="Not reported"
                onBlur={(e) => updateField(t, "actual_value", e.target.value)}
                data-testid={`target-actual-${t.id}`}
              />
              <div className="col-span-2 text-right tabular-nums text-sm">
                {/* One target row, not a node in the hierarchy — a percentage band is what this means. */}
                <PerformanceBadge pct={pct} thresholds={project.performance_thresholds} showLabel={false} />
                <span className="ml-2 text-xs text-muted-foreground">{fmtPct(pct)}</span>
              </div>
              <button onClick={() => remove(t)} className="col-span-1 flex justify-end text-muted-foreground hover:text-destructive" aria-label="Delete target">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add a period -- chosen from the measure's own list, never typed. */}
      <div className="mt-3 flex flex-wrap gap-2 items-center">
        {available.length > 0 ? (
          <>
            <Select value={newPeriod} onValueChange={setNewPeriod}>
              <SelectTrigger className="h-8 w-44 text-xs" data-testid={`period-select-${measure.id}`}>
                <SelectValue placeholder={measure.time_period === "Quarterly" ? "Add a quarter…" : "Add a period…"} />
              </SelectTrigger>
              <SelectContent>
                {available.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-full text-xs"
              onClick={() => addPeriod(newPeriod)}
              disabled={busy || !newPeriod}
              data-testid={`add-period-${measure.id}`}
            >
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            {measure.time_period === "Quarterly" ? "All four quarters are listed." : "The annual period is listed."}
          </span>
        )}
      </div>

    </div>
  );
};

export default TargetEditor;
