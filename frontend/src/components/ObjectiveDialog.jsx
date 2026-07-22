import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_OPTIONS, STATUS_OPTIONS, PERSPECTIVES } from "../lib/constants";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useScorecard } from "../context/ScorecardContext";
import { objectiveSchema } from "../lib/validation";
import { perspectiveObjectiveWeightSum } from "../lib/calculations";

const empty = {
  name: "", description: "", priority: "Medium", owner: "", timeline: "",
  status: "On Track", color: "#721B29", department_id: null, perspective_id: "financial", weight: 0,
};

const ObjectiveDialog = ({ open, onOpenChange, objective, defaultPerspective, defaultDepartment }) => {
  const { project, refreshProject } = useScorecard();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (objective) {
      setForm({ ...empty, ...objective, department_id: objective.department_id || null });
    } else {
      setForm({ ...empty, perspective_id: defaultPerspective || "financial", department_id: defaultDepartment || null });
    }
  }, [objective, defaultPerspective, defaultDepartment, open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const payload = { ...form, weight: Number(form.weight) || 0 };
    const res = objectiveSchema.safeParse(payload);
    if (!res.success) {
      toast.error(res.error.issues[0].message);
      return;
    }
    // Duplicate check
    const dup = project.objectives.find(
      (o) => o.name.trim().toLowerCase() === payload.name.trim().toLowerCase() && o.id !== objective?.id
    );
    if (dup) {
      toast.error("An objective with that name already exists");
      return;
    }
    // Weight sanity within perspective
    const others = project.objectives
      .filter((o) => o.perspective_id === payload.perspective_id && o.id !== objective?.id)
      .reduce((a, o) => a + (Number(o.weight) || 0), 0);
    if (others + payload.weight > 100.001) {
      toast.warning(`Perspective weight would exceed 100% (${(others + payload.weight).toFixed(1)}%)`);
    }
    setSaving(true);
    try {
      if (objective) {
        await api.updateObjective(project.id, objective.id, payload);
        toast.success("Objective updated");
      } else {
        await api.addObjective(project.id, payload);
        toast.success("Objective added");
      }
      await refreshProject();
      onOpenChange(false);
    } catch {
      toast.error("Could not save objective");
    } finally {
      setSaving(false);
    }
  };

  if (!project) return null;
  const currentPWeight = perspectiveObjectiveWeightSum(form.perspective_id, project.objectives.filter((o) => o.id !== objective?.id)) + (Number(form.weight) || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="objective-dialog">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{objective ? "Edit objective" : "New strategic objective"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <F label="Name *" className="md:col-span-2">
            <Input data-testid="objective-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </F>
          <F label="Description" className="md:col-span-2">
            <Textarea rows={2} data-testid="objective-description" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </F>
          <F label="Perspective *">
            <Select value={form.perspective_id} onValueChange={(v) => set("perspective_id", v)}>
              <SelectTrigger data-testid="objective-perspective"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERSPECTIVES.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label="Department">
            <Select
              value={form.department_id || "__none__"}
              onValueChange={(v) => set("department_id", v === "__none__" ? null : v)}
            >
              <SelectTrigger data-testid="objective-department"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {project.departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label="Owner">
            <Input data-testid="objective-owner" value={form.owner} onChange={(e) => set("owner", e.target.value)} />
          </F>
          <F label="Timeline">
            <Input data-testid="objective-timeline" value={form.timeline} onChange={(e) => set("timeline", e.target.value)} placeholder="e.g. FY26" />
          </F>
          <F label="Priority">
            <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label="Status">
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label={`Weight in Perspective (%) — total will be ${currentPWeight.toFixed(1)}%`}>
            <Input
              data-testid="objective-weight"
              type="number" min="0" max="100" step="0.1"
              value={form.weight}
              onChange={(e) => set("weight", parseFloat(e.target.value || "0"))}
            />
          </F>
          <F label="Color">
            <Input type="color" value={form.color} onChange={(e) => set("color", e.target.value)} className="h-10 p-1 w-24" />
          </F>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button data-testid="objective-save" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : objective ? "Save changes" : "Create objective"}
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

export default ObjectiveDialog;
