import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import InitiativeDialog from "../components/InitiativeDialog";
import { useScorecard } from "../context/ScorecardContext";
import { Plus, Pencil, Trash2, Search, Rocket, Copy } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { INIT } from "../constants/testIds";
import FilterBar, { applyObjectiveFilter } from "../components/FilterBar";
import { RISK_OPTIONS } from "../lib/constants";
import { cn } from "@/lib/utils";

const InitiativesView = ({ filters, setFilters }) => {
  const { project, refreshProject } = useScorecard();
  const [dialog, setDialog] = useState({ open: false, initiative: null });
  const [query, setQuery] = useState("");

  const measuresInScope = useMemo(() => {
    const objIds = new Set(project.objectives.filter((o) => applyObjectiveFilter(project, o, filters)).map((o) => o.id));
    return new Set(project.measures.filter((m) => objIds.has(m.objective_id)).map((m) => m.id));
  }, [project, filters]);

  const inits = useMemo(() => {
    const q = query.trim().toLowerCase();
    return project.initiatives.filter((i) => {
      // filter: risk
      if (filters.risk && i.risk_level !== filters.risk) return false;
      if (filters.status && i.status !== filters.status) return false;
      if (filters.owner && i.owner !== filters.owner) return false;
      // must overlap with scope
      if (filters.perspective_id || filters.department_id || filters.owner) {
        const mids = i.measure_ids || [];
        if (mids.length === 0) return false;
        if (!mids.some((id) => measuresInScope.has(id))) return false;
      }
      if (q && !i.name.toLowerCase().includes(q) && !(i.description || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [project.initiatives, filters, measuresInScope, query]);

  const del = async (i) => {
    if (!window.confirm(`Delete initiative "${i.name}"?`)) return;
    try { await api.deleteInitiative(project.id, i.id); await refreshProject(); toast.success("Initiative deleted"); }
    catch { toast.error("Could not delete"); }
  };

  const duplicate = async (i) => {
    try {
      const clone = { ...i, name: `${i.name} (Copy)` };
      delete clone.id;
      await api.addInitiative(project.id, clone);
      await refreshProject();
      toast.success("Duplicated");
    } catch { toast.error("Could not duplicate"); }
  };

  return (
    <div className="space-y-4" data-testid="initiatives-view">
      <FilterBar filters={filters} setFilters={setFilters} showRisk />

      <Card className="p-4 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-8 w-72"
            placeholder="Search initiatives…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="text-sm text-muted-foreground">{inits.length} initiative{inits.length === 1 ? "" : "s"}</div>
        <div className="ml-auto">
          <Button onClick={() => setDialog({ open: true, initiative: null })} data-testid={INIT.addBtn}>
            <Plus className="h-4 w-4 mr-1.5" /> Initiative
          </Button>
        </div>
      </Card>

      {inits.length === 0 ? (
        <Card className="p-14 text-center border-dashed">
          <Rocket className="h-6 w-6 mx-auto text-muted-foreground" />
          <h3 className="mt-3 font-serif text-2xl">No initiatives yet</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Add the strategic initiatives that will move your measures. Link each initiative to the measures it impacts.
          </p>
          <Button className="mt-5" onClick={() => setDialog({ open: true, initiative: null })}>
            <Plus className="h-4 w-4 mr-1.5" /> Add initiative
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {inits.map((i) => {
            const linked = project.measures.filter((m) => (i.measure_ids || []).includes(m.id));
            const riskColor = i.risk_level === "High" ? "border-rag-red/50 text-rag-red bg-rag-red/5"
              : i.risk_level === "Medium" ? "border-rag-amber/50 text-rag-amber bg-rag-amber/5"
              : "border-rag-green/50 text-rag-green bg-rag-green/5";
            return (
              <Card key={i.id} className="p-5" data-testid={`initiative-card-${i.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h3 className="font-serif text-lg leading-tight">{i.name}</h3>
                      <Badge variant="outline" className={cn("text-[10px]", riskColor)}>Risk: {i.risk_level}</Badge>
                      <Badge variant="outline" className="text-[10px]">{i.status}</Badge>
                    </div>
                    {i.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{i.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setDialog({ open: true, initiative: i })}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => duplicate(i)}><Copy className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="tabular-nums font-medium">{Number(i.progress) || 0}%</span>
                  </div>
                  <Progress value={Number(i.progress) || 0} className="h-1.5" />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Owner</div>
                    <div className="font-medium truncate">{i.owner || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Budget</div>
                    <div className="font-medium">€{Number(i.budget || 0).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Timeline</div>
                    <div className="font-medium truncate">{i.start_date || "—"} → {i.end_date || "—"}</div>
                  </div>
                </div>

                {linked.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1.5">Linked measures</div>
                    <div className="flex flex-wrap gap-1.5">
                      {linked.map((m) => (
                        <Badge key={m.id} variant="outline" className="text-[10px]">{m.name}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <InitiativeDialog
        open={dialog.open}
        onOpenChange={(v) => setDialog((s) => ({ ...s, open: v }))}
        initiative={dialog.initiative}
      />
    </div>
  );
};

export default InitiativesView;
