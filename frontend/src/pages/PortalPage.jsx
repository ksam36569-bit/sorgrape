import React from "react";
import { useNavigate } from "react-router-dom";
import { useScorecard } from "../context/ScorecardContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { api } from "../lib/api";
import { Copy, Trash2, ChevronRight, Plus, Grape } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";

const PortalPage = () => {
  const { projects, loading, loadProject, refreshProjects } = useScorecard();
  const navigate = useNavigate();

  const open = async (id) => {
    await loadProject(id);
    navigate("/scorecard");
  };
  const duplicate = async (id) => {
    try {
      await api.duplicateProject(id);
      await refreshProjects();
      toast.success("Duplicated");
    } catch { toast.error("Could not duplicate"); }
  };
  const remove = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    try {
      await api.deleteProject(id);
      await refreshProjects();
      toast.success("Deleted");
    } catch { toast.error("Could not delete"); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="max-w-6xl mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Grape className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Sogrape</div>
              <div className="font-serif text-lg">Balanced Scorecard Portal</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate("/setup")}><Plus className="h-4 w-4 mr-1.5" /> New scorecard</Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-14">
        <div className="mb-10">
          <div className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Projects</div>
          <h1 className="mt-2 font-serif text-4xl sm:text-5xl">Your scorecards</h1>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            Track every strategic objective, measure and initiative across your business. Open one to
            continue, or start a fresh scorecard.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
          </div>
        ) : projects.length === 0 ? (
          <Card className="p-14 text-center border-dashed">
            <h3 className="font-serif text-2xl">Nothing here yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">Create your first scorecard to begin.</p>
            <Button className="mt-6" onClick={() => navigate("/setup")}>
              <Plus className="h-4 w-4 mr-1.5" /> New scorecard
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
            {projects.map((p) => (
              <Card
                key={p.id}
                className="group p-6 relative overflow-hidden hover:-translate-y-0.5 transition-transform"
                data-testid={`portal-project-${p.id}`}
              >
                <div className="absolute right-4 top-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="ghost" onClick={() => duplicate(p.id)} aria-label="Duplicate">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(p.id, p.company_name)} aria-label="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  {p.industry || "—"} · {p.fiscal_year || "—"}
                </div>
                <h3 className="mt-2 font-serif text-2xl leading-tight">{p.company_name}</h3>
                <div className="mt-4 text-xs text-muted-foreground flex items-center gap-3">
                  <span>{p.objectives_count} objectives</span>
                  <span>·</span>
                  <span>{p.measures_count} measures</span>
                </div>
                <Button
                  variant="ghost"
                  className="mt-6 h-8 px-0 text-primary hover:bg-transparent hover:text-primary/80"
                  onClick={() => open(p.id)}
                >
                  Open scorecard <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default PortalPage;
