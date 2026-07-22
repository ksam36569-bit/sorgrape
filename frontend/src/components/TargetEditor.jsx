import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useScorecard } from "../context/ScorecardContext";
import PerformanceBadge from "./PerformanceBadge";
import { achievementPct, measureAchievement, fmtPct } from "../lib/calculations";
import { annualPeriods, quarterPeriods } from "../lib/constants";
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
    () => (project?.targets || []).filter((t) => t.measure_id === measure.id).sort((a, b) => a.period.localeCompare(b.period)),
    [project, measure.id]
  );

  const suggestedPeriods = useMemo(() => {
    const fy = project?.fiscal_year || "";
    return measure.time_period === "Quarterly" ? quarterPeriods(fy) : annualPeriods(fy);
  }, [measure.time_period, project?.fiscal_year]);

  const existing = new Set(targets.map((t) => t.period));
  const quickAdd = suggestedPeriods.filter((p) => !existing.has(p));

  const addPeriod = async (period) => {
    if (!period.trim()) return;
    setBusy(true);
    try {
      await api.addTarget(project.id, {
        measure_id: measure.id, period: period.trim(), target_value: 0, actual_value: 0,
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
    const val = parseFloat(value || "0");
    if (val < 0) {
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
          Targets · {measure.time_period}
        </div>
        <PerformanceBadge pct={avg} thresholds={project.performance_thresholds} testId={`measure-achievement-${measure.id}`} />
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
          const pct = achievementPct(t.actual_value, t.target_value);
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
                defaultValue={t.actual_value}
                onBlur={(e) => updateField(t, "actual_value", e.target.value)}
                data-testid={`target-actual-${t.id}`}
              />
              <div className="col-span-2 text-right tabular-nums text-sm">
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

      {/* Quick add */}
      <div className="mt-3 flex flex-wrap gap-2 items-center">
        {quickAdd.map((p) => (
          <Button
            key={p}
            size="sm"
            variant="outline"
            className="h-7 rounded-full text-xs"
            onClick={() => addPeriod(p)}
            disabled={busy}
            data-testid={`quick-add-period-${p}`}
          >
            <Plus className="h-3 w-3 mr-1" /> {p}
          </Button>
        ))}
        <div className="flex items-center gap-1">
          <Input
            className="h-7 w-32 text-xs"
            placeholder="Custom period…"
            value={newPeriod}
            onChange={(e) => setNewPeriod(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addPeriod(newPeriod)}
          />
          <Button size="sm" variant="ghost" onClick={() => addPeriod(newPeriod)} disabled={!newPeriod.trim()}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TargetEditor;
