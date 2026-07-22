import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Pencil, Trash2, Plus, Copy } from "lucide-react";
import PerformanceBadge from "./PerformanceBadge";
import TargetEditor from "./TargetEditor";
import { useScorecard } from "../context/ScorecardContext";
import { api } from "../lib/api";
import { toast } from "sonner";
import {
  objectiveScore, measureAchievement, measureWeightedScore, measureRating, fmtPct,
  objectiveMeasureWeightSum,
} from "../lib/calculations";
import { PERSPECTIVE_MAP } from "../lib/constants";

const ObjectiveCard = ({ objective, onEdit, onAddMeasure, onEditMeasure }) => {
  const { project, refreshProject } = useScorecard();
  const [open, setOpen] = useState(true);

  const measures = project.measures.filter((m) => m.objective_id === objective.id);
  const score = objectiveScore(objective, project.measures, project.targets);
  const weightSum = objectiveMeasureWeightSum(objective.id, project.measures);
  const dept = project.departments.find((d) => d.id === objective.department_id);
  const persp = PERSPECTIVE_MAP[objective.perspective_id];

  const del = async () => {
    if (!window.confirm(`Delete objective "${objective.name}" and its measures?`)) return;
    try {
      await api.deleteObjective(project.id, objective.id);
      await refreshProject();
      toast.success("Objective deleted");
    } catch {
      toast.error("Could not delete");
    }
  };

  const duplicate = async () => {
    try {
      const clone = { ...objective, name: `${objective.name} (Copy)` };
      delete clone.id;
      await api.addObjective(project.id, clone);
      await refreshProject();
      toast.success("Objective duplicated");
    } catch {
      toast.error("Could not duplicate");
    }
  };

  const delMeasure = async (m) => {
    if (!window.confirm(`Delete measure "${m.name}"?`)) return;
    try {
      await api.deleteMeasure(project.id, m.id);
      await refreshProject();
      toast.success("Measure deleted");
    } catch {
      toast.error("Could not delete");
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <Card className="overflow-hidden" data-testid={`objective-card-${objective.id}`}>
        <div className="flex items-start gap-3 p-5 border-l-4" style={{ borderLeftColor: objective.color || "#721B29" }}>
          <button onClick={() => setOpen((o) => !o)} className="mt-1 text-muted-foreground hover:text-foreground">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="font-serif text-xl leading-tight">{objective.name}</h3>
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {persp?.short}
              </span>
              {dept && (
                <Badge variant="outline" className="text-[10px] tracking-wider">
                  {dept.name}
                </Badge>
              )}
            </div>
            {objective.description && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{objective.description}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Owner:</span>
              <span className="font-medium">{objective.owner || "—"}</span>
              <span className="mx-2 text-muted-foreground/60">·</span>
              <span className="text-muted-foreground">Timeline:</span>
              <span className="font-medium">{objective.timeline || "—"}</span>
              <span className="mx-2 text-muted-foreground/60">·</span>
              <span className="text-muted-foreground">Weight:</span>
              <span className="font-medium">{fmtPct(objective.weight || 0, 0)}</span>
              <span className="mx-2 text-muted-foreground/60">·</span>
              <span className="text-muted-foreground">Measure wt:</span>
              <span className={`font-medium tabular-nums ${Math.abs(weightSum - 100) > 0.5 && measures.length ? "text-rag-amber" : ""}`}>
                {fmtPct(weightSum, 0)}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <PerformanceBadge pct={score} thresholds={project.performance_thresholds} testId={`objective-score-${objective.id}`} />
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => onEdit(objective)} data-testid={`objective-edit-${objective.id}`}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={duplicate}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={del} data-testid={`objective-delete-${objective.id}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {open && (
          <div className="border-t border-border bg-muted/30 px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Measures / KPIs</h4>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAddMeasure(objective.id)}
                data-testid={`objective-add-measure-${objective.id}`}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add measure
              </Button>
            </div>

            {measures.length === 0 && (
              <div className="text-sm text-muted-foreground italic">No measures yet. Add one to start tracking.</div>
            )}

            <div className="space-y-4">
              {measures.map((m) => {
                const ach = measureAchievement(m, project.targets);
                const contrib = measureWeightedScore(m, project.targets);
                const rag = measureRating(m, project.targets, project.performance_thresholds);
                return (
                  <div key={m.id} className="rounded-lg border border-border bg-card p-4" data-testid={`measure-row-${m.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <div className="font-medium">{m.name}</div>
                          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            {m.unit} · {m.time_period}
                          </span>
                        </div>
                        {m.description && <div className="text-xs text-muted-foreground mt-0.5">{m.description}</div>}
                        <div className="mt-1.5 text-xs text-muted-foreground flex flex-wrap gap-x-3">
                          <span>Weight: <b className="text-foreground">{fmtPct(m.weight || 0, 0)}</b></span>
                          <span>Baseline: <b className="text-foreground">{m.baseline}</b></span>
                          <span>Stretch: <b className="text-foreground">{m.stretch_target}</b></span>
                          {m.owner && <span>Owner: <b className="text-foreground">{m.owner}</b></span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <PerformanceBadge
                          pct={ach}
                          rating={rag}
                          thresholds={project.performance_thresholds}
                          testId={`measure-rag-${m.id}`}
                        />
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Weighted score</div>
                          <div className="font-serif text-lg tabular-nums">{fmtPct(contrib)}</div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => onEditMeasure(m)} data-testid={`measure-edit-${m.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => delMeasure(m)} data-testid={`measure-delete-${m.id}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <TargetEditor measure={m} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
};

export default ObjectiveCard;
