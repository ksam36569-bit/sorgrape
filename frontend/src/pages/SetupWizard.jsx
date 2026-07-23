import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Plus, ChevronRight, ChevronLeft } from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";
import { SETUP } from "../constants/testIds";
import { useScorecard } from "../context/ScorecardContext";
import { projectSchema } from "../lib/validation";

const STEPS = ["Identity", "Strategy", "Structure", "Review"];

const SetupWizard = () => {
  const navigate = useNavigate();
  const { createProject } = useScorecard();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    company_name: "Sogrape",
    industry: "Wine & Spirits",
    fiscal_year: "FY26",
    business_unit: "",
    vision: "",
    mission: "",
    strategic_themes: "",
    prepared_by: "",
    prepared_date: new Date().toISOString().slice(0, 10),
  });

  const [departments, setDepartments] = useState([
    "Sales & Distribution",
    "Marketing",
    "Winemaking",
    "Finance",
  ]);
  const [newDept, setNewDept] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const addDept = () => {
    const v = newDept.trim();
    if (!v) return;
    if (departments.map((d) => d.toLowerCase()).includes(v.toLowerCase())) {
      toast.error("Department already exists");
      return;
    }
    setDepartments([...departments, v]);
    setNewDept("");
  };

  const next = () => {
    if (step === 0) {
      const res = projectSchema.safeParse(form);
      if (!res.success) {
        toast.error(res.error.issues[0].message);
        return;
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    setSaving(true);
    try {
      await createProject({ ...form, departments });
      toast.success(`${form.company_name} scorecard created`);
      navigate("/scorecard");
    } catch (e) {
      toast.error("Could not create project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid={SETUP.root} className="min-h-screen bg-background text-foreground">
      {/* Editorial header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-8 py-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo height={40} chip />
            <div className="font-serif text-lg">Scorecard Setup</div>
          </div>
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <div
                  className={`h-2 w-8 rounded-full transition-colors ${
                    i <= step ? "bg-primary" : "bg-muted"
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-14">
        <div className="mb-10">
          <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </div>
          <h1 className="mt-2 font-serif text-4xl sm:text-5xl">
            {step === 0 && "Let's begin with the essentials"}
            {step === 1 && "Define your strategic north star"}
            {step === 2 && "Shape the business structure"}
            {step === 3 && "Review and toast the launch"}
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            {step === 0 && "A few details to anchor this scorecard in your company's identity."}
            {step === 1 && "Your vision, mission and strategic themes will guide every objective."}
            {step === 2 && "Add the departments that will own objectives and measures."}
            {step === 3 && "Everything looks good? Create the scorecard and step into the portal."}
          </p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {step === 0 && (
              <Card className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="Company Name *">
                  <Input
                    data-testid={SETUP.companyName}
                    value={form.company_name}
                    onChange={(e) => set("company_name", e.target.value)}
                    placeholder="Sogrape"
                  />
                </Field>
                <Field label="Industry">
                  <Input
                    data-testid={SETUP.industry}
                    value={form.industry}
                    onChange={(e) => set("industry", e.target.value)}
                    placeholder="Wine & Spirits"
                  />
                </Field>
                <Field label="Fiscal Year">
                  <Input
                    data-testid={SETUP.fiscalYear}
                    value={form.fiscal_year}
                    onChange={(e) => set("fiscal_year", e.target.value)}
                    placeholder="FY26"
                  />
                </Field>
                <Field label="Business Unit">
                  <Input
                    data-testid={SETUP.businessUnit}
                    value={form.business_unit}
                    onChange={(e) => set("business_unit", e.target.value)}
                    placeholder="Portugal · Wines"
                  />
                </Field>
                <Field label="Prepared By">
                  <Input
                    data-testid={SETUP.preparedBy}
                    value={form.prepared_by}
                    onChange={(e) => set("prepared_by", e.target.value)}
                    placeholder="Strategy Office"
                  />
                </Field>
                <Field label="Date">
                  <Input
                    data-testid={SETUP.preparedDate}
                    type="date"
                    value={form.prepared_date}
                    onChange={(e) => set("prepared_date", e.target.value)}
                  />
                </Field>
              </Card>
            )}

            {step === 1 && (
              <Card className="p-8 space-y-6">
                <Field label="Vision">
                  <Textarea
                    data-testid={SETUP.vision}
                    rows={3}
                    value={form.vision}
                    onChange={(e) => set("vision", e.target.value)}
                    placeholder="To share our passion for wine with the world…"
                  />
                </Field>
                <Field label="Mission">
                  <Textarea
                    data-testid={SETUP.mission}
                    rows={3}
                    value={form.mission}
                    onChange={(e) => set("mission", e.target.value)}
                    placeholder="Making great wine, sustainably, from the finest terroirs."
                  />
                </Field>
                <Field label="Strategic Themes">
                  <Textarea
                    data-testid={SETUP.strategicThemes}
                    rows={3}
                    value={form.strategic_themes}
                    onChange={(e) => set("strategic_themes", e.target.value)}
                    placeholder="Sustainable Growth · Premiumization · Digital · Global Expansion"
                  />
                </Field>
              </Card>
            )}

            {step === 2 && (
              <Card className="p-8">
                <div className="flex items-center gap-2">
                  <Input
                    data-testid={SETUP.departmentInput}
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    placeholder="e.g. Winemaking, Marketing, R&D"
                    onKeyDown={(e) => e.key === "Enter" && addDept()}
                    className="max-w-md"
                  />
                  <Button
                    data-testid={SETUP.departmentAdd}
                    onClick={addDept}
                    variant="secondary"
                  >
                    <Plus className="h-4 w-4 mr-1.5" /> Add
                  </Button>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  {departments.map((d) => (
                    <Badge
                      key={d}
                      variant="outline"
                      className="px-3 py-1.5 text-sm border-primary/30 bg-primary/5 gap-2"
                    >
                      {d}
                      <button
                        onClick={() => setDepartments(departments.filter((x) => x !== d))}
                        aria-label={`Remove ${d}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </Badge>
                  ))}
                  {departments.length === 0 && (
                    <p className="text-sm text-muted-foreground">No departments yet.</p>
                  )}
                </div>
              </Card>
            )}

            {step === 3 && (
              <Card className="p-8 space-y-6">
                <ReviewRow label="Company" value={form.company_name} />
                <ReviewRow label="Industry" value={form.industry || "—"} />
                <ReviewRow label="Fiscal Year" value={form.fiscal_year || "—"} />
                <ReviewRow label="Business Unit" value={form.business_unit || "—"} />
                <ReviewRow label="Vision" value={form.vision || "—"} multiline />
                <ReviewRow label="Mission" value={form.mission || "—"} multiline />
                <ReviewRow label="Strategic Themes" value={form.strategic_themes || "—"} multiline />
                <ReviewRow
                  label="Departments"
                  value={departments.length ? departments.join(" · ") : "—"}
                />
              </Card>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-10 flex items-center justify-between">
          <Button
            data-testid={SETUP.back}
            variant="ghost"
            onClick={back}
            disabled={step === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              data-testid={SETUP.next}
              onClick={next}
              className="rounded-full px-8"
            >
              Continue <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              data-testid={SETUP.submit}
              onClick={submit}
              disabled={saving}
              className="rounded-full px-8 bg-primary text-primary-foreground"
            >
              {saving ? "Creating…" : "Create scorecard"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children }) => (
  <div className="space-y-2">
    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
      {label}
    </Label>
    {children}
  </div>
);

const ReviewRow = ({ label, value, multiline }) => (
  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-baseline border-b border-border pb-4 last:border-0 last:pb-0">
    <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
    <div className={`md:col-span-3 text-sm ${multiline ? "whitespace-pre-line" : ""}`}>{value}</div>
  </div>
);

export default SetupWizard;
