import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { useScorecard } from "../context/ScorecardContext";
import { api } from "../lib/api";
import {
  krProgress, krProgressClamped, okrProgress, krStatus, krStatusReason,
  okrStatus, STATUS_LABEL,
} from "../lib/okr";
import { fmtPct } from "../lib/calculations";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown, ChevronUp, Plus, Trash2, Target, ArrowUp, ArrowDown, Pencil, Check,
} from "lucide-react";

const DOT = { green: "bg-rag-green", amber: "bg-rag-amber", red: "bg-rag-red" };

/**
 * Progress bar with a marker at 100% of target, matching the scorecard's bars.
 * The bar clamps but the number does not, so the marker is what makes an
 * overshoot legible instead of just a full bar.
 */
const ProgressBar = ({ pct, status }) => (
  <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
    <div className={`h-full rounded-full transition-all duration-500 ${DOT[status]}`} style={{ width: `${pct}%` }} />
    <div className="absolute inset-y-0 right-0 w-px bg-foreground/35" aria-hidden />
  </div>
);

const StatusBadge = ({ status, title }) => (
  <span title={title} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-medium">
    <span className={`h-2 w-2 rounded-full ${DOT[status]}`} aria-hidden />
    {STATUS_LABEL[status]}
  </span>
);

/** One key result: a row that becomes a form in place when edited. */
const KeyResultRow = ({ kr, onSave, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(kr);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Preview what is being typed, so progress moves live while editing.
  const shown = editing ? form : kr;
  const pct = krProgress(shown);
  const status = krStatus(shown);

  const save = async () => {
    setBusy(true);
    try {
      await onSave({
        ...form,
        baseline: Number(form.baseline) || 0,
        current_value: Number(form.current_value) || 0,
        target: Number(form.target) || 0,
        status_override: form.status_override || null,
      });
      setEditing(false);
    } catch {
      toast.error("Could not save that key result");
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <div className="rounded-lg border border-border bg-card p-4" data-testid={`kr-row-${kr.id}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium leading-snug">{kr.description}</div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>Baseline <b className="text-foreground tabular-nums">{kr.baseline}{kr.unit}</b></span>
              <span>Current <b className="text-foreground tabular-nums">{kr.current_value}{kr.unit}</b></span>
              <span>Target <b className="text-foreground tabular-nums">{kr.target}{kr.unit}</b></span>
              {kr.owner && <span>Owner <b className="text-foreground">{kr.owner}</b></span>}
              {kr.due_date && <span>Due <b className="text-foreground">{kr.due_date}</b></span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StatusBadge status={status} title={krStatusReason(kr)} />
            <div className="font-serif text-lg tabular-nums leading-none">{pct === null ? "—" : fmtPct(pct, 0)}</div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => { setForm(kr); setEditing(true); }} data-testid={`kr-edit-${kr.id}`}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={onDelete} data-testid={`kr-delete-${kr.id}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <ProgressBar pct={krProgressClamped(kr)} status={status} />
          <div className="mt-1.5 text-[11px] text-muted-foreground">{krStatusReason(kr)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-card p-4 space-y-3" data-testid={`kr-form-${kr.id}`}>
      <Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What does success look like?" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[["baseline", "Baseline"], ["current_value", "Current"], ["target", "Target"], ["unit", "Unit"]].map(([k, label]) => (
          <label key={k} className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {label}
            <Input className="mt-1" value={form[k] ?? ""} onChange={(e) => set(k, e.target.value)} data-testid={`kr-input-${k}-${kr.id}`} />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Owner
          <Input className="mt-1" value={form.owner ?? ""} onChange={(e) => set("owner", e.target.value)} placeholder="Person or team" />
        </label>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Due date
          <Input className="mt-1" type="date" value={form.due_date ?? ""} onChange={(e) => set("due_date", e.target.value)} />
        </label>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Status
          <Select value={form.status_override || "auto"} onValueChange={(v) => set("status_override", v === "auto" ? null : v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto — progress vs. pace</SelectItem>
              <SelectItem value="green">On track</SelectItem>
              <SelectItem value="amber">At risk</SelectItem>
              <SelectItem value="red">Off track</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="text-xs text-muted-foreground">
          {pct === null ? "Target equals baseline — nothing to measure" : `Now reads ${fmtPct(pct, 0)}`}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={busy} data-testid={`kr-save-${kr.id}`}>
            <Check className="h-3.5 w-3.5 mr-1.5" /> Save
          </Button>
        </div>
      </div>
    </div>
  );
};

const OkrCard = ({ okr, keyResults, index, total, actions }) => {
  const [open, setOpen] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(okr.title);
  const pct = okrProgress(keyResults);
  const status = okrStatus(keyResults);

  return (
    <Card className="p-5" data-testid={`okr-card-${okr.id}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Objective {index + 1}</div>
          {editingTitle ? (
            <div className="mt-1.5 flex gap-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              <Button size="sm" onClick={async () => { await actions.renameOkr(okr, title); setEditingTitle(false); }}>Save</Button>
            </div>
          ) : (
            <h3 className="font-serif text-xl md:text-2xl mt-1 leading-tight">{okr.title}</h3>
          )}
          {okr.owner && <div className="mt-1 text-xs text-muted-foreground">Owner <b className="text-foreground">{okr.owner}</b></div>}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatusBadge status={status} title="Worst status among this objective's key results" />
          <div className="font-serif text-2xl tabular-nums leading-none">{pct === null ? "—" : fmtPct(pct, 0)}</div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" disabled={index === 0} onClick={() => actions.move(index, -1)} data-testid={`okr-up-${okr.id}`}>
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" disabled={index === total - 1} onClick={() => actions.move(index, 1)} data-testid={`okr-down-${okr.id}`}>
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => { setTitle(okr.title); setEditingTitle(true); }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => actions.removeOkr(okr)} data-testid={`okr-delete-${okr.id}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <ProgressBar pct={pct === null ? 0 : Math.max(0, Math.min(100, pct))} status={status} />
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Average of {keyResults.length} key result{keyResults.length === 1 ? "" : "s"}</span>
          <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 hover:text-foreground transition-colors" data-testid={`okr-toggle-${okr.id}`}>
            {open ? "Hide" : "Show"} key results
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          {keyResults.length === 0 && (
            <div className="text-sm text-muted-foreground italic">No key results yet — add one to start measuring this objective.</div>
          )}
          {keyResults.map((kr) => (
            <KeyResultRow key={kr.id} kr={kr} onSave={(v) => actions.saveKr(kr, v)} onDelete={() => actions.removeKr(kr)} />
          ))}
          <Button variant="outline" size="sm" onClick={() => actions.addKr(okr)} data-testid={`okr-add-kr-${okr.id}`}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add key result
          </Button>
        </div>
      )}
    </Card>
  );
};

const OkrsView = () => {
  const { project, refreshProject } = useScorecard();

  const okrs = useMemo(() => project?.okrs || [], [project]);
  const krsByOkr = useMemo(() => {
    const map = new Map();
    for (const kr of project?.key_results || []) {
      if (!map.has(kr.okr_id)) map.set(kr.okr_id, []);
      map.get(kr.okr_id).push(kr);
    }
    return map;
  }, [project]);

  const run = async (fn, message) => {
    try {
      await fn();
      await refreshProject();
      if (message) toast.success(message);
    } catch (e) {
      toast.error(e?.message || "Something went wrong");
    }
  };

  const actions = {
    move: (index, delta) => {
      const next = [...okrs];
      const [moved] = next.splice(index, 1);
      next.splice(index + delta, 0, moved);
      return run(() => api.reorderOkrs(project.id, next.map((o) => o.id)));
    },
    renameOkr: (okr, title) => run(() => api.updateOkr(project.id, okr.id, { ...okr, title }), "Objective renamed"),
    removeOkr: (okr) => run(() => api.deleteOkr(project.id, okr.id), "Objective deleted"),
    addKr: (okr) => run(() => api.addKeyResult(project.id, okr.id, {
      description: "New key result", baseline: 0, current_value: 0, target: 100, unit: "%", owner: "", due_date: "",
    }), "Key result added"),
    saveKr: (kr, values) => run(() => api.updateKeyResult(project.id, kr.id, values), "Key result saved"),
    removeKr: (kr) => run(() => api.deleteKeyResult(project.id, kr.id), "Key result deleted"),
  };

  const addOkr = () => run(() => api.addOkr(project.id, { title: "New objective", owner: "" }), "Objective added");

  if (!project) return null;
  const overall = okrProgress(project.key_results || []);

  return (
    <div className="space-y-5" data-testid="okrs-view">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Objectives &amp; Key Results</div>
          <h2 className="font-serif text-3xl mt-1">OKRs</h2>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
            Progress is how far a key result has travelled from its baseline toward its target.
            Status compares that against how much of the time has passed, unless you set it by hand.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {overall !== null && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">All key results</div>
              <div className="font-serif text-2xl tabular-nums">{fmtPct(overall, 0)}</div>
            </div>
          )}
          <Button onClick={addOkr} data-testid="okr-add">
            <Plus className="h-4 w-4 mr-1.5" /> Objective
          </Button>
        </div>
      </div>

      {okrs.length === 0 ? (
        <Card className="p-12 text-center">
          <Target className="h-8 w-8 mx-auto text-muted-foreground/50" />
          <h3 className="font-serif text-2xl mt-4">No objectives yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">Add an objective, then give it the key results that say whether you got there.</p>
          <Button className="mt-5" onClick={addOkr}><Plus className="h-4 w-4 mr-1.5" /> Add the first objective</Button>
        </Card>
      ) : (
        okrs.map((okr, i) => (
          <OkrCard key={okr.id} okr={okr} index={i} total={okrs.length} keyResults={krsByOkr.get(okr.id) || []} actions={actions} />
        ))
      )}
    </div>
  );
};

export default OkrsView;
