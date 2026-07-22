import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { downloadTemplate, downloadActualsTemplate, parseWorkbook, guessEntity, normaliseRow, KNOWN_ENTITIES } from "../lib/excel";
import { objectiveSchema, measureSchema, targetSchema, initiativeSchema } from "../lib/validation";
import { api } from "../lib/api";
import { useScorecard } from "../context/ScorecardContext";
import { IMPORT } from "../constants/testIds";
import { FileDown, Upload, AlertCircle, CheckCircle2 } from "lucide-react";

const validateByEntity = (entity, row) => {
  if (entity === "Departments") return row.name ? { ok: true } : { ok: false, error: "Department 'name' is required" };
  if (entity === "Objectives") {
    const r = objectiveSchema.safeParse({
      name: row.name || "",
      description: row.description || "",
      priority: row.priority || "Medium",
      owner: row.owner || "",
      timeline: row.timeline || "",
      status: row.status || "On Track",
      color: row.color || "#721B29",
      department_id: row.department_id || null,
      perspective_id: row.perspective_id || "financial",
      weight: Number(row.weight) || 0,
    });
    return r.success ? { ok: true } : { ok: false, error: r.error.issues[0].message };
  }
  if (entity === "Measures") {
    const r = measureSchema.safeParse({
      name: row.name || "",
      description: row.description || "",
      unit: row.unit || "%",
      weight: Number(row.weight) || 0,
      baseline: Number(row.baseline) || 0,
      stretch_target: Number(row.stretch_target) || 0,
      time_period: (row.time_period === "Quarterly" ? "Quarterly" : "Annual"),
      owner: row.owner || "",
      data_source: row.data_source || "",
      comments: row.comments || "",
      objective_id: row.objective || row.objective_id || "unknown",
    });
    return r.success ? { ok: true } : { ok: false, error: r.error.issues[0].message };
  }
  if (entity === "Targets") {
    const r = targetSchema.safeParse({
      measure_id: row.measure || row.measure_id || "unknown",
      period: row.period || "",
      target_value: Number(row.target_value) || 0,
      actual_value: Number(row.actual_value) || 0,
    });
    return r.success ? { ok: true } : { ok: false, error: r.error.issues[0].message };
  }
  if (entity === "Initiatives") {
    const r = initiativeSchema.safeParse({
      name: row.name || "",
      description: row.description || "",
      budget: Number(row.budget) || 0,
      owner: row.owner || "",
      start_date: row.start_date || "",
      end_date: row.end_date || "",
      progress: Number(row.progress) || 0,
      status: row.status || "Planned",
      risk_level: row.risk_level || "Low",
      expected_impact: row.expected_impact || "",
      dependencies: row.dependencies || "",
      measure_ids: [],
    });
    return r.success ? { ok: true } : { ok: false, error: r.error.issues[0].message };
  }
  return { ok: true };
};

const BulkImportDialog = ({ open, onOpenChange }) => {
  const { project, refreshProject } = useScorecard();
  const [step, setStep] = useState("upload"); // upload | map | preview
  const [mode, setMode] = useState("add");
  const [sheets, setSheets] = useState(null); // { sheetName: rows[] }
  const [mapping, setMapping] = useState({}); // sheetName -> entity | 'ignore'
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep("upload"); setSheets(null); setMapping({}); setMode("add");
  };

  const handleFile = async (file) => {
    if (!file) return;
    try {
      const parsed = await parseWorkbook(file);
      setSheets(parsed);
      const guessed = {};
      let hasKnown = false;
      for (const name of Object.keys(parsed)) {
        const g = guessEntity(name);
        guessed[name] = g || "ignore";
        if (g) hasKnown = true;
      }
      setMapping(guessed);
      setStep(hasKnown && Object.values(guessed).every((v) => v !== "ignore" || parsed[Object.keys(parsed).find((k) => mapping[k] === "ignore")]?.length === 0) ? "preview" : "map");
    } catch (e) {
      toast.error("Could not parse workbook");
    }
  };

  const preview = useMemo(() => {
    if (!sheets) return { rows: {}, errors: {}, stats: { total: 0, valid: 0, invalid: 0 } };
    const rows = {};
    const errors = {};
    let total = 0, invalid = 0;
    const seenNames = { Departments: new Set(), Objectives: new Set(), Measures: new Set(), Initiatives: new Set() };
    for (const [sheetName, sheetRows] of Object.entries(sheets)) {
      const entity = mapping[sheetName];
      if (!entity || entity === "ignore") continue;
      rows[entity] = rows[entity] || [];
      errors[entity] = errors[entity] || [];
      for (const raw of sheetRows) {
        const row = normaliseRow(entity, raw);
        total++;
        const v = validateByEntity(entity, row);
        let err = v.ok ? null : v.error;
        if (!err && (entity === "Departments" || entity === "Objectives" || entity === "Measures" || entity === "Initiatives")) {
          const key = (row.name || "").trim().toLowerCase();
          if (key && seenNames[entity].has(key)) err = `Duplicate name in file: ${row.name}`;
          if (key) seenNames[entity].add(key);
        }
        rows[entity].push({ ...row, __error: err });
        if (err) { invalid++; errors[entity].push({ row, error: err }); }
      }
    }
    return { rows, errors, stats: { total, valid: total - invalid, invalid } };
  }, [sheets, mapping]);

  const commit = async () => {
    setBusy(true);
    try {
      const payload = { mode };
      for (const [entity, list] of Object.entries(preview.rows)) {
        const key = entity.toLowerCase();
        payload[key] = list.filter((r) => !r.__error).map(({ __error, ...rest }) => rest);
      }
      const res = await api.bulkImport(project.id, payload);
      toast.success(`Imported ${res.stats.created} · updated ${res.stats.updated}`);
      await refreshProject();
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error("Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col" data-testid={IMPORT.root}>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Bulk import from Excel</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="py-6 space-y-6">
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Upload a .xlsx workbook with sheets for Departments, Objectives, Measures, Targets, Initiatives.
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFile(e.target.files?.[0])}
                className="hidden"
                id="bulk-import-file"
                data-testid={IMPORT.fileInput}
              />
              <label
                htmlFor="bulk-import-file"
                className="mt-4 inline-flex items-center justify-center h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm cursor-pointer hover:opacity-90"
              >
                Choose file
              </label>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <div className="text-muted-foreground">Need the template?</div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={downloadTemplate} data-testid={IMPORT.downloadTemplate}>
                  <FileDown className="h-4 w-4 mr-1.5" /> Full template
                </Button>
                <Button variant="outline" onClick={downloadActualsTemplate}>
                  <FileDown className="h-4 w-4 mr-1.5" /> Actuals template
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "map" && sheets && (
          <div className="py-4 space-y-4 flex-1 overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              Assign each sheet to an entity type. Sheets can be ignored.
            </p>
            <div className="space-y-2">
              {Object.entries(sheets).map(([name, rows]) => (
                <div key={name} className="flex items-center gap-4 p-3 border border-border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{name}</div>
                    <div className="text-xs text-muted-foreground">{rows.length} rows</div>
                  </div>
                  <Select value={mapping[name] || "ignore"} onValueChange={(v) => setMapping((m) => ({ ...m, [name]: v }))}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ignore">Ignore this sheet</SelectItem>
                      {KNOWN_ENTITIES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={reset}>Back</Button>
              <Button onClick={() => setStep("preview")}>Continue to preview</Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="flex-1 overflow-hidden flex flex-col" data-testid={IMPORT.preview}>
            <div className="flex items-center gap-6 py-3 border-b border-border">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 rag-green" />
                <span><b>{preview.stats.valid}</b> valid</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 rag-red" />
                <span><b>{preview.stats.invalid}</b> invalid</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Total: {preview.stats.total}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mode</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger className="w-48 h-8" data-testid={IMPORT.modeSelect}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Add as new</SelectItem>
                    <SelectItem value="update">Update by name</SelectItem>
                    <SelectItem value="replace">Replace all data</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Tabs defaultValue={Object.keys(preview.rows)[0] || "Departments"} className="flex-1 overflow-hidden flex flex-col mt-3">
              <TabsList className="w-fit">
                {Object.keys(preview.rows).map((e) => (
                  <TabsTrigger key={e} value={e}>
                    {e} <span className="ml-1.5 text-muted-foreground text-xs">({preview.rows[e].length})</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {Object.entries(preview.rows).map(([entity, list]) => (
                <TabsContent key={entity} value={entity} className="flex-1 overflow-y-auto mt-3">
                  <PreviewTable entity={entity} rows={list} />
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}

        {step === "preview" && (
          <DialogFooter className="pt-3 border-t border-border">
            <Button variant="ghost" onClick={reset}>Start over</Button>
            <Button onClick={commit} disabled={busy || preview.stats.valid === 0} data-testid={IMPORT.confirm}>
              {busy ? "Importing…" : `Commit ${preview.stats.valid} valid row${preview.stats.valid === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

const PreviewTable = ({ entity, rows }) => {
  if (rows.length === 0) return <div className="text-sm text-muted-foreground py-6">No rows.</div>;
  const cols = Object.keys(rows[0]).filter((k) => k !== "__error").slice(0, 8);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">#</TableHead>
          {cols.map((c) => <TableHead key={c} className="text-xs uppercase tracking-wider">{c}</TableHead>)}
          <TableHead className="w-32">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i} className={r.__error ? "bg-rag-red/5" : ""}>
            <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
            {cols.map((c) => (
              <TableCell key={c} className="text-xs max-w-[200px] truncate">{String(r[c] ?? "—")}</TableCell>
            ))}
            <TableCell>
              {r.__error ? (
                <Badge variant="outline" className="text-[10px] border-rag-red/50 text-rag-red bg-rag-red/5">
                  {r.__error}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] border-rag-green/50 text-rag-green bg-rag-green/5">
                  Valid
                </Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default BulkImportDialog;
