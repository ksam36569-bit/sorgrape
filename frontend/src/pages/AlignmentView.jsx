import React from "react";
import { Card } from "@/components/ui/card";
import { useScorecard } from "../context/ScorecardContext";
import PerformanceBadge from "../components/PerformanceBadge";
import { PERSPECTIVES, PERSPECTIVE_MAP } from "../lib/constants";
import {
  overallScore, perspectiveScore, objectiveScore, measureAchievement,
  measureContributionPct, fmtPct,
} from "../lib/calculations";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

const AlignmentView = () => {
  const { project } = useScorecard();
  const overall = overallScore(project);

  return (
    <div className="space-y-6" data-testid="alignment-view">
      <Card className="p-6">
        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Strategic alignment</div>
        <div className="mt-1 flex items-baseline gap-3 flex-wrap">
          <h2 className="font-serif text-4xl">{fmtPct(overall)}</h2>
          <PerformanceBadge pct={overall} thresholds={project.performance_thresholds} />
          <span className="text-sm text-muted-foreground">Overall balanced score, rolled up from every measure.</span>
        </div>
      </Card>

      <div className="space-y-6">
        {PERSPECTIVES.map((p) => {
          const objs = project.objectives.filter((o) => o.perspective_id === p.id);
          if (objs.length === 0) return null;
          const pScore = perspectiveScore(p.id, project.objectives, project.measures, project.targets);
          const pWeight = Number(project.perspective_weights?.[p.id]) || 0;
          const contribution = (pScore * pWeight) / 100;
          return (
            <motion.section
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              data-testid={`alignment-perspective-${p.id}`}
            >
              <div className="flex items-baseline gap-3 mb-3 flex-wrap">
                <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Perspective</div>
                <h3 className="font-serif text-2xl">{p.name}</h3>
                <span className="text-sm text-muted-foreground">weight <b className="text-foreground">{pWeight}%</b></span>
                <span className="text-sm text-muted-foreground">score <b className="text-foreground">{fmtPct(pScore)}</b></span>
                <span className="text-sm text-muted-foreground">contribution to overall <b className="text-foreground">{fmtPct(contribution)}</b></span>
                <PerformanceBadge pct={pScore} thresholds={project.performance_thresholds} showLabel={false} />
              </div>

              <div className="space-y-3">
                {objs.map((o) => {
                  const oScore = objectiveScore(o, project.measures, project.targets);
                  const measures = project.measures.filter((m) => m.objective_id === o.id);
                  return (
                    <div key={o.id} className="rounded-lg border border-border bg-card overflow-hidden">
                      {/* Objective row */}
                      <div className="p-4 border-b border-border flex items-center gap-3 bg-muted/30">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: o.color || "#721B29" }} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{o.name}</div>
                          <div className="text-xs text-muted-foreground">
                            weight {o.weight || 0}% · contributes {fmtPct((oScore * (o.weight || 0)) / 100)} to {PERSPECTIVE_MAP[p.id]?.short}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Objective score</div>
                          <div className="font-serif text-lg tabular-nums">{fmtPct(oScore)}</div>
                        </div>
                        <PerformanceBadge pct={oScore} thresholds={project.performance_thresholds} showLabel={false} />
                      </div>

                      {/* Measures & initiatives */}
                      {measures.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground italic">No measures yet.</div>
                      ) : (
                        <div className="p-4 space-y-2">
                          {measures.map((m) => {
                            const mPct = measureAchievement(m, project.targets);
                            const contrib = measureContributionPct(m, project.measures, project.targets);
                            const inits = project.initiatives.filter((i) => (i.measure_ids || []).includes(m.id));
                            return (
                              <div key={m.id} className="pl-4 border-l-2 border-border">
                                <div className="flex items-center gap-2 text-sm flex-wrap">
                                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                  <div className="font-medium">{m.name}</div>
                                  <span className="text-xs text-muted-foreground">weight {m.weight || 0}%</span>
                                  <span className="text-xs text-muted-foreground">contribution {contrib.toFixed(1)}%</span>
                                  <div className="ml-auto flex items-center gap-2">
                                    <span className="tabular-nums text-sm">{fmtPct(mPct)}</span>
                                    <PerformanceBadge pct={mPct} thresholds={project.performance_thresholds} showLabel={false} />
                                  </div>
                                </div>
                                {inits.length > 0 && (
                                  <div className="mt-1.5 ml-5 space-y-1">
                                    {inits.map((i) => (
                                      <div key={i.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className="h-1 w-3 rounded-full bg-primary/40" />
                                        <span className="truncate">{i.name}</span>
                                        <span className="ml-auto tabular-nums">{Number(i.progress) || 0}%</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.section>
          );
        })}
      </div>
    </div>
  );
};

export default AlignmentView;
