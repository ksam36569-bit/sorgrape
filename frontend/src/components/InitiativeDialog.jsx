import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_OPTIONS, RISK_OPTIONS } from "../lib/constants";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useScorecard } from "../context/ScorecardContext";
import { initiativeSchema } from "../lib/validation";
import { Slider } from "@/components/ui/slider";
import { INIT } from "../constants/testIds";

const empty = {
  name: "", description: "", budget: 0, owner: "",
  start_date: "", end_date: "", progress: 0, status: "Planned",
  risk_level: "Low", expected_impact: "", dependencies: "", measure_ids: [],
};

const InitiativeDialog = ({ open, onOpenChange, initiative }) => {
  const { project, refreshProject } = useScorecard();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initiative) setForm({ ...empty, ...initiative, measure_ids: initiative.measure_ids || [] });
    else setForm(empty);
  }, [initiative, open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleMeasure = (id) => {
    setForm((f) => ({ ...f, measure_ids: f.measure_ids.includes(id) ? f.measure_ids.filter((x) => x !== id) : [...f.measure_ids, id] }));
  };

  const submit = async () => {
    const payload = {
      ...form,
      budget: Number(form.budget) || 0,
      progress: Number(form.progress) || 0,
    };
    const res = initiativeSchema.safeParse(payload);
    if (!res.success) {
      toast.error(res.error.issues[0].message);
      return;
    }
    setSaving(true);
    try {
      if (initiative) {
        await api.updateInitiative(project.id, initiative.id, payload);
        toast.success("Initiative updated");
      } else {
        await api.addInitiative(project.id, payload);
        toast.success("Initiative added");
      }
      await refreshProject();
      onOpenChange(false);
    } catch {
      toast.error("Could not save initiative");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto" data-testid={INIT.dialog}>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{initiative ? "Edit initiative" : "New strategic initiative"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <F label="Name *" className="md:col-span-2">
            <Input data-testid={INIT.name} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </F>
          <F label="Description" className="md:col-span-2">
            <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </F>
          <F label="Owner">
            <Input value={form.owner} onChange={(e) => set("owner", e.target.value)} />
          </F>
          <F label="Budget (€)">
            <Input type="number" step="0.01" min="0" value={form.budget} onChange={(e) => set("budget", parseFloat(e.target.value || "0"))} />
          </F>
          <F label="Start date">
            <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
          </F>
          <F label="End date">
            <Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
          </F>
          <F label="Status">
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Planned">Planned</SelectItem>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label="Risk">
            <Select value={form.risk_level} onValueChange={(v) => set("risk_level", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RISK_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label={`Progress — ${form.progress}%`} className="md:col-span-2">
            <Slider min={0} max={100} step={1} value={[Number(form.progress) || 0]} onValueChange={(v) => set("progress", v[0])} />
          </F>
          <F label="Expected impact" className="md:col-span-2">
            <Textarea rows={2} value={form.expected_impact} onChange={(e) => set("expected_impact", e.target.value)} />
          </F>
          <F label="Dependencies" className="md:col-span-2">
            <Textarea rows={2} value={form.dependencies} onChange={(e) => set("dependencies", e.target.value)} />
          </F>
          <F label="Linked measures" className="md:col-span-2">
            <div className="max-h-48 overflow-y-auto border border-border rounded-md p-2 space-y-1">
              {project.measures.length === 0 && <div className="text-sm text-muted-foreground italic">No measures yet.</div>}
              {project.measures.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm py-1 px-1 hover:bg-muted/50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.measure_ids.includes(m.id)}
                    onChange={() => toggleMeasure(m.id)}
                    className="rounded border-border"
                  />
                  <span className="flex-1">{m.name}</span>
                  <span className="text-xs text-muted-foreground">{project.objectives.find((o) => o.id === m.objective_id)?.name}</span>
                </label>
              ))}
            </div>
          </F>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving} data-testid={INIT.save}>
            {saving ? "Saving…" : initiative ? "Save changes" : "Create initiative"}
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

export default InitiativeDialog;
