import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UNIT_OPTIONS, TIME_PERIOD_OPTIONS, TIME_PERIOD_LABELS } from "../lib/constants";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useScorecard } from "../context/ScorecardContext";
import { measureSchema } from "../lib/validation";
import { objectiveMeasureWeightSum } from "../lib/calculations";

const empty = {
  name: "", description: "", unit: "%", weight: 0, baseline: 0, stretch_target: 0,
  time_period: "Annual", direction: "higher", green_threshold: "", amber_threshold: "",
  owner: "", data_source: "", comments: "", objective_id: "",
};

const MeasureDialog = ({ open, onOpenChange, measure, defaultObjective }) => {
  const { project, refreshProject } = useScorecard();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (measure) setForm({ ...empty, ...measure });
    else setForm({ ...empty, objective_id: defaultObjective || project?.objectives?.[0]?.id || "" });
  }, [measure, defaultObjective, open, project]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const payload = {
      ...form,
      weight: Number(form.weight) || 0,
      baseline: Number(form.baseline) || 0,
      stretch_target: Number(form.stretch_target) || 0,
    };
    const res = measureSchema.safeParse(payload);
    if (!res.success) {
      toast.error(res.error.issues[0].message);
      return;
    }
    if (!payload.objective_id) {
      toast.error("Please select an objective");
      return;
    }
    const dup = project.measures.find(
      (m) => m.name.trim().toLowerCase() === payload.name.trim().toLowerCase() && m.id !== measure?.id
    );
    if (dup) {
      toast.error("A measure with that name already exists");
      return;
    }
    const sibling = objectiveMeasureWeightSum(
      payload.objective_id,
      project.measures.filter((m) => m.id !== measure?.id)
    );
    if (sibling + payload.weight > 100.001) {
      toast.warning(`Total measure weight in this objective would be ${(sibling + payload.weight).toFixed(1)}%`);
    }
    setSaving(true);
    try {
      if (measure) {
        await api.updateMeasure(project.id, measure.id, payload);
        toast.success("Measure updated");
      } else {
        await api.addMeasure(project.id, payload);
        toast.success("Measure added");
      }
      await refreshProject();
      onOpenChange(false);
    } catch {
      toast.error("Could not save measure");
    } finally {
      setSaving(false);
    }
  };

  if (!project) return null;
  const sibling = objectiveMeasureWeightSum(form.objective_id, project.measures.filter((m) => m.id !== measure?.id)) + (Number(form.weight) || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto" data-testid="measure-dialog">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{measure ? "Edit measure" : "New measure (KPI)"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <F label="Name *" className="md:col-span-2">
            <Input data-testid="measure-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </F>
          <F label="Objective *" className="md:col-span-2">
            <Select value={form.objective_id} onValueChange={(v) => set("objective_id", v)}>
              <SelectTrigger data-testid="measure-objective"><SelectValue placeholder="Choose objective" /></SelectTrigger>
              <SelectContent>
                {project.objectives.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label="Description" className="md:col-span-2">
            <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </F>
          <F label="Unit">
            <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
              <SelectTrigger data-testid="measure-unit"><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label="Direction">
            <Select value={form.direction || "higher"} onValueChange={(v) => set("direction", v)}>
              <SelectTrigger data-testid="measure-direction"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="higher">Higher is better</SelectItem>
                <SelectItem value="lower">Lower is better</SelectItem>
              </SelectContent>
            </Select>
          </F>
          <F label="Green at (optional)">
            <Input
              value={form.green_threshold ?? ""}
              onChange={(e) => set("green_threshold", e.target.value)}
              placeholder="e.g. 15"
              data-testid="measure-green-threshold"
            />
          </F>
          <F label="Amber at (optional)">
            <Input
              value={form.amber_threshold ?? ""}
              onChange={(e) => set("amber_threshold", e.target.value)}
              placeholder="e.g. 5"
              data-testid="measure-amber-threshold"
            />
          </F>
          <F label="Time Period">
            <Select value={form.time_period} onValueChange={(v) => set("time_period", v)}>
              <SelectTrigger data-testid="measure-time-period"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIME_PERIOD_OPTIONS.map((u) => <SelectItem key={u} value={u}>{TIME_PERIOD_LABELS[u] || u}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label={`Weight (%) — total will be ${sibling.toFixed(1)}%`}>
            <Input
              data-testid="measure-weight"
              type="number" min="0" max="100" step="0.1"
              value={form.weight}
              onChange={(e) => set("weight", parseFloat(e.target.value || "0"))}
            />
          </F>
          <F label="Baseline">
            <Input type="number" step="0.01" value={form.baseline} onChange={(e) => set("baseline", parseFloat(e.target.value || "0"))} />
          </F>
          <F label="Stretch Target">
            <Input type="number" step="0.01" value={form.stretch_target} onChange={(e) => set("stretch_target", parseFloat(e.target.value || "0"))} />
          </F>
          <F label="Owner">
            <Input value={form.owner} onChange={(e) => set("owner", e.target.value)} />
          </F>
          <F label="Data Source" className="md:col-span-2">
            <Input value={form.data_source} onChange={(e) => set("data_source", e.target.value)} />
          </F>
          <F label="Comments" className="md:col-span-2">
            <Textarea rows={2} value={form.comments} onChange={(e) => set("comments", e.target.value)} />
          </F>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button data-testid="measure-save" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : measure ? "Save changes" : "Create measure"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const F = ({ label, children, className = "" }) => (
  <div className={`space-y-2 ${className}`}>
    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</Label>
    {children}
  </div>
);

export default MeasureDialog;
