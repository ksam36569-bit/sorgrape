import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, RadialBarChart, RadialBar, CartesianGrid, ReferenceLine,
} from "recharts";
import {
  Globe, Wine, Lightbulb, Handshake, Recycle, Leaf, HeartHandshake, Award,
  Download, FileJson, ImageDown, ShieldCheck, CheckCircle2, ChevronDown, ExternalLink,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTheme } from "../context/ThemeProvider";
import { toast } from "sonner";
import {
  SUSTAINABILITY_SCORE, SNAPSHOT_RANGE,
  buildVerification, sourcesUsed, seriesFor, metricById, esgTimeline, verifiedAtLabel,
} from "../lib/performanceSnapshot";
import { exportSnapshotPDF, exportSnapshotPNG, exportSnapshotJSON } from "../lib/performanceExport";

const PALETTE_LIGHT = ["#721B29", "#9F5E46", "#C6A87C", "#35824C", "#8A2A3D", "#B37B5A"];
const PALETTE_DARK = ["#9B2A3E", "#B8755D", "#D8BC94", "#4A9B61", "#C56078", "#E5A122"];
const GREEN = "#35824C";
const AMBER = "#D98A29";
const RED = "#D93838";

const ICONS = {
  countries_served: Globe,
  brand_portfolio: Wine,
  innovation_projects: Lightbulb,
  strategic_partnerships: Handshake,
};

// ------------------------------------------------------------- count-up
function useCountUp(target, { duration = 1100, enabled = true } = {}) {
  const [val, setVal] = useState(enabled ? 0 : target);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!enabled || reduce || typeof target !== "number" || Number.isNaN(target)) {
      setVal(target);
      return undefined;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled, reduce]);
  return val;
}

const fadeIn = (i = 0) => ({
  initial: { opacity: 0, y: 10 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.4, delay: i * 0.05 },
});

// ------------------------------------------------------------- score ring
const ScoreRing = memo(function ScoreRing({ value, size = 132, label = "/ 100" }) {
  const reduce = useReducedMotion();
  const shown = useCountUp(value, { enabled: !reduce });
  const data = [{ name: "score", value, fill: GREEN }];
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`Sustainability score ${value} out of 100`}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="72%" outerRadius="100%" data={data} startAngle={90} endAngle={90 - (value / 100) * 360}>
          <RadialBar dataKey="value" cornerRadius={20} background={{ fill: "hsl(var(--muted))" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-serif text-4xl tabular-nums leading-none">{Math.round(shown)}</div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mt-1">{label}</div>
      </div>
    </div>
  );
});

// ------------------------------------------------------------- progress ring
const ProgressRing = memo(function ProgressRing({ value, max = 100, size = 128, color = GREEN, center, caption }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const data = [{ name: "v", value: pct, fill: color }];
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }} role="img" aria-label={caption || `${value}`}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="74%" outerRadius="100%" data={data} startAngle={90} endAngle={90 - (pct / 100) * 360}>
            <RadialBar dataKey="value" cornerRadius={16} background={{ fill: "hsl(var(--muted))" }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="font-serif text-2xl tabular-nums">{center}</div>
        </div>
      </div>
      {caption && <div className="mt-2 text-xs text-muted-foreground text-center">{caption}</div>}
    </div>
  );
});

// ------------------------------------------------------------- section head
const SectionHead = ({ icon: Icon, title, sub }) => (
  <div className="flex items-center gap-2.5 mb-4">
    {Icon && (
      <span className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
        <Icon className="h-4 w-4 text-primary" />
      </span>
    )}
    <div>
      <h2 className="font-serif text-xl leading-tight">{title}</h2>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  </div>
);

const ChartCard = memo(function ChartCard({ title, hint, source, children, index = 0 }) {
  return (
    <motion.div {...fadeIn(index)}>
      <Card className="p-5 h-full">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <h3 className="font-serif text-base">{title}</h3>
          {hint && <span className="text-[11px] text-muted-foreground tabular-nums">{hint}</span>}
        </div>
        <div className="h-56">{children}</div>
        {source && <div className="mt-2 text-[10px] text-muted-foreground">{source}</div>}
      </Card>
    </motion.div>
  );
});

// ------------------------------------------------------------- KPI card
const KpiCard = memo(function KpiCard({ record, index }) {
  const m = metricById(record.id);
  const Icon = ICONS[record.id] || Globe;
  const latestNum = m.numeric[record.year];
  const reduce = useReducedMotion();
  const shown = useCountUp(typeof latestNum === "number" ? latestNum : 0, { enabled: !reduce });
  const suffix = /\+/.test(String(record.value)) ? "+" : "";
  const display = typeof latestNum === "number"
    ? `${Math.round(shown).toLocaleString()}${suffix}`
    : record.value;

  return (
    <motion.div {...fadeIn(index)}>
      <HoverCard openDelay={80} closeDelay={40}>
        <HoverCardTrigger asChild>
          <Card
            className="p-5 h-full cursor-default hover:-translate-y-0.5 transition-transform focus-within:ring-2 focus-within:ring-primary/40"
            tabIndex={0}
            aria-label={`${record.metric}: ${record.value}. Source ${record.source}, ${record.year}.`}
          >
            <div className="flex items-center justify-between">
              <span className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon className="h-4 w-4 text-primary" />
              </span>
              {record.corroboratedOnSite && (
                <Badge variant="secondary" className="text-[9px] gap-1">
                  <CheckCircle2 className="h-3 w-3 text-rag-green" /> site-verified
                </Badge>
              )}
            </div>
            <div className="mt-3 font-serif text-3xl tabular-nums">{display}</div>
            <div className="mt-1 text-sm text-muted-foreground">{record.metric}</div>
          </Card>
        </HoverCardTrigger>
        <HoverCardContent className="w-72 text-xs">
          <div className="font-medium text-sm mb-1">{record.metric}</div>
          <dl className="space-y-1">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Value</dt><dd className="tabular-nums">{record.value}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Report year</dt><dd>{record.year}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Source</dt><dd className="text-right">{record.source}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Last verified</dt><dd>{verifiedAtLabel()}</dd></div>
          </dl>
          {record.sourceUrl && (
            <a href={record.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-primary hover:underline">
              Open source <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </HoverCardContent>
      </HoverCard>
    </motion.div>
  );
});

// ------------------------------------------------------------- timeline
const Timeline = memo(function Timeline() {
  const items = esgTimeline();
  return (
    <ol className="relative border-l border-border ml-3" aria-label="ESG timeline 2022 to 2024">
      {items.map((it, i) => (
        <motion.li key={it.year} {...fadeIn(i)} className="mb-6 ml-6">
          <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-medium">
            {String(it.year).slice(2)}
          </span>
          <div className="flex items-center gap-2">
            <h4 className="font-serif text-base">{it.year}</h4>
            <span className="text-xs text-muted-foreground">· {it.title}</span>
          </div>
          <ul className="mt-1.5 space-y-1">
            {it.points.map((p, j) => (
              <li key={j} className="text-sm text-foreground/85 flex gap-2">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-primary/60 shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </motion.li>
      ))}
    </ol>
  );
});

// ------------------------------------------------------------- main view
const PerformanceSnapshotView = () => {
  const { theme } = useTheme();
  const palette = theme === "dark" ? PALETTE_DARK : PALETTE_LIGHT;
  const axis = theme === "dark" ? "#C9B9BB" : "#5B4B4D";
  const grid = theme === "dark" ? "#3A2B2D" : "#EADFDB";
  const tooltipStyle = { background: theme === "dark" ? "#241819" : "#fff", border: `1px solid ${grid}`, borderRadius: 8, fontSize: 12 };

  const { verified, excluded } = useMemo(() => buildVerification(), []);
  const usedSources = useMemo(() => sourcesUsed(), []);
  const topKpis = useMemo(() => verified.filter((v) => v.category === "top"), [verified]);
  const [busy, setBusy] = useState(null);

  const wasteSeries = useMemo(() => seriesFor("waste_recovery_rate"), []);
  const ghgSeries = useMemo(() => seriesFor("ghg_reduction"), []);
  const scope2Series = useMemo(() => seriesFor("scope2_reduction"), []);
  const packaging = metricById("packaging_recyclability").numeric[2024];
  const wasteRecovery2024 = metricById("waste_recovery_rate").numeric[2024];
  const co2 = metricById("co2_avoided").numeric[2024];
  const landfill = metricById("waste_to_landfill").numeric[2024];
  const livingLabs = metricById("living_labs").numeric[2024];
  const rainfed = metricById("rainfed_vineyards").numeric[2024];
  const volunteering = metricById("corporate_volunteering").numeric[2024];
  const award = metricById("sustainability_awards").display[2024];

  const recoveryDonut = [
    { name: "Recovered", value: wasteRecovery2024, fill: GREEN },
    { name: "Not recovered", value: Number((100 - wasteRecovery2024).toFixed(2)), fill: grid },
  ];

  const runExport = async (kind, fn) => {
    setBusy(kind);
    try {
      await fn();
      toast.success(`${kind.toUpperCase()} exported`);
    } catch (e) {
      toast.error(`Could not export ${kind.toUpperCase()}`);
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div data-testid="performance-snapshot" className="space-y-8">
      {/* Export bar (outside capture so buttons aren't baked into the image) */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => runExport("pdf", exportSnapshotPDF)}>
          <Download className="h-4 w-4 mr-1.5" /> PDF
        </Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => runExport("png", exportSnapshotPNG)}>
          <ImageDown className="h-4 w-4 mr-1.5" /> PNG
        </Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => runExport("json", exportSnapshotJSON)}>
          <FileJson className="h-4 w-4 mr-1.5" /> JSON
        </Button>
      </div>

      <div id="performance-snapshot-capture" className="space-y-10">
        {/* SECTION 1 — HERO */}
        <motion.section {...fadeIn(0)}>
          <Card className="p-6 lg:p-8 overflow-hidden relative">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] items-center">
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Performance Snapshot</div>
                <h1 className="font-serif text-3xl lg:text-4xl mt-1">{SNAPSHOT_RANGE.from}–{SNAPSHOT_RANGE.to}</h1>
                <p className="mt-2 text-sm text-muted-foreground max-w-xl">
                  Publicly disclosed performance and ESG indicators from Sogrape's official website and Sustainability Reports.
                </p>
                <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Stat label="Metrics verified" value={String(verified.length)} />
                  <Stat label="Last verified" value={verifiedAtLabel()} />
                  <Stat label="Reports used" value={String(usedSources.filter((s) => s.type === "Sustainability Report").length)} />
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {usedSources.map((s) => (
                    <a key={s.id} href={s.url} target="_blank" rel="noreferrer">
                      <Badge variant="outline" className="gap-1 hover:bg-muted">
                        {s.label} <ExternalLink className="h-3 w-3" />
                      </Badge>
                    </a>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-center gap-2 justify-self-center">
                <ScoreRing value={SUSTAINABILITY_SCORE} />
                <div className="text-xs text-muted-foreground">Sustainability Score</div>
              </div>
            </div>
          </Card>
        </motion.section>

        {/* SECTION 2 — TOP KPI CARDS */}
        <section>
          <SectionHead icon={Award} title="Top Performance" sub="Hover a card for its source, report year and verification date." />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {topKpis.map((r, i) => <KpiCard key={r.id} record={r} index={i} />)}
          </div>
        </section>

        {/* SECTION 3 — SUSTAINABILITY */}
        <section>
          <SectionHead icon={Leaf} title="Sustainability" sub="Trends and disclosed reductions." />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Waste Recovery Trend" hint="2022–2024" source="Source: Sogrape Sustainability Reports 2022–2024" index={0}>
              <ResponsiveContainer>
                <LineChart data={wasteSeries} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
                  <CartesianGrid stroke={grid} vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: axis, fontSize: 12 }} />
                  <YAxis domain={[95, 100]} tick={{ fill: axis, fontSize: 12 }} unit="%" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, _n, p) => [p?.payload?.display ?? `${v}%`, "Recovery"]} />
                  <Line type="monotone" dataKey="value" stroke={GREEN} strokeWidth={2.5} dot={{ r: 4, fill: GREEN }} isAnimationActive />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Packaging Recyclability" hint="2024" source="Source: Sogrape Sustainability Report 2024" index={1}>
              <div className="h-full flex items-center justify-center">
                <ProgressRing value={packaging} max={100} color={palette[2]} center={`${packaging}%`} caption="of packaging recyclable" />
              </div>
            </ChartCard>

            <ChartCard title="GHG Emissions Reduction (vs 2021)" hint="2024: −13.5%" source="Source: Sogrape Sustainability Report 2024 (2023 disclosed qualitatively, not plotted)" index={2}>
              <ResponsiveContainer>
                <BarChart data={ghgSeries} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
                  <CartesianGrid stroke={grid} vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: axis, fontSize: 12 }} />
                  <YAxis domain={[-30, 5]} tick={{ fill: axis, fontSize: 12 }} unit="%" />
                  <ReferenceLine y={0} stroke={axis} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "vs 2021"]} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} fill={GREEN} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Scope 2 Emissions Reduction" hint="2024: −23.2%" source="Source: Sogrape Sustainability Report 2024" index={3}>
              <ResponsiveContainer>
                <BarChart data={scope2Series} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
                  <CartesianGrid stroke={grid} vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: axis, fontSize: 12 }} />
                  <YAxis domain={[-30, 5]} tick={{ fill: axis, fontSize: 12 }} unit="%" />
                  <ReferenceLine y={0} stroke={axis} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "vs 2021"]} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} fill={palette[3]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </section>

        {/* SECTION 4 — CIRCULAR ECONOMY */}
        <section>
          <SectionHead icon={Recycle} title="Circular Economy" sub="Disclosed 2024 figures." />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ChartCard title="Waste Recovery" hint="2024" source="Source: Sogrape Sustainability Report 2024" index={0}>
              <div className="relative h-full">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={recoveryDonut} dataKey="value" innerRadius="62%" outerRadius="90%" startAngle={90} endAngle={-270} stroke="none">
                      {recoveryDonut.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${v}%`, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="font-serif text-2xl tabular-nums">{wasteRecovery2024}%</div>
                  <div className="text-[10px] text-muted-foreground">recovered</div>
                </div>
              </div>
            </ChartCard>

            <ChartCard title="CO₂ Avoided" hint="since PV plants" source="Source: Sogrape Sustainability page (Portugal & Argentina)" index={1}>
              <div className="h-full flex items-center justify-center">
                <ProgressRing value={100} max={100} color={GREEN} center={`${co2}+`} caption="tons CO₂ avoided" />
              </div>
            </ChartCard>

            <ChartCard title="Waste to Landfill" hint="2024" source="Source: Sogrape Sustainability Report 2024" index={2}>
              <div className="h-full flex flex-col items-center justify-center">
                <div className="font-serif text-4xl tabular-nums">{landfill}</div>
                <div className="text-sm text-muted-foreground mt-1">tons to landfill</div>
                <Badge variant="secondary" className="mt-3">97.89% waste recovery rate</Badge>
              </div>
            </ChartCard>
          </div>
        </section>

        {/* SECTION 5 — BIODIVERSITY */}
        <section>
          <SectionHead icon={Leaf} title="Biodiversity" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div {...fadeIn(0)}>
              <Card className="p-6 flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Living Labs</div>
                  <CountStat target={livingLabs} className="font-serif text-4xl tabular-nums mt-1" />
                  <div className="text-xs text-muted-foreground mt-1">2022: 1 → 2024: 2</div>
                </div>
                <span className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Leaf className="h-6 w-6 text-primary" />
                </span>
              </Card>
            </motion.div>
            <motion.div {...fadeIn(1)}>
              <Card className="p-6 flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Rainfed Vineyards (Portugal)</div>
                  <div className="text-xs text-muted-foreground mt-1">Stable across 2022–2024</div>
                </div>
                <ProgressRing value={rainfed} max={100} size={104} color={palette[1]} center={`${rainfed}%`} />
              </Card>
            </motion.div>
          </div>
        </section>

        {/* SECTION 6 — SOCIAL */}
        <section>
          <SectionHead icon={HeartHandshake} title="Social Impact" />
          <motion.div {...fadeIn(0)}>
            <Card className="p-6 flex items-center justify-between max-w-md">
              <div>
                <div className="text-sm text-muted-foreground">Corporate Volunteering</div>
                <div className="flex items-baseline gap-2">
                  <CountStat target={volunteering} className="font-serif text-4xl tabular-nums mt-1" />
                  <span className="text-lg text-muted-foreground">hours</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Disclosed 2024</div>
              </div>
              <span className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <HeartHandshake className="h-6 w-6 text-primary" />
              </span>
            </Card>
          </motion.div>
        </section>

        {/* SECTION 7 — RECOGNITION + TIMELINE */}
        <section>
          <SectionHead icon={Award} title="Recognition" />
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
            <motion.div {...fadeIn(0)}>
              <Card className="p-6">
                <Award className="h-8 w-8 text-sogrape-gold" />
                <div className="mt-3 font-serif text-xl">{award}</div>
                <div className="text-sm text-muted-foreground mt-1">Sustainability Awards · 2024</div>
                <Badge variant="secondary" className="mt-3">IWCA member (Bodegas LAN, Silver)</Badge>
              </Card>
            </motion.div>
            <Card className="p-6">
              <h3 className="font-serif text-lg mb-4">ESG Timeline · {SNAPSHOT_RANGE.from}–{SNAPSHOT_RANGE.to}</h3>
              <Timeline />
            </Card>
          </div>
        </section>

        {/* SOURCE VERIFICATION PANEL */}
        <SourceVerificationPanel verified={verified} excluded={excluded} />
      </div>
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
    <div className="font-serif text-lg mt-0.5 tabular-nums">{value}</div>
  </div>
);

const CountStat = memo(function CountStat({ target, className }) {
  const reduce = useReducedMotion();
  const v = useCountUp(target, { enabled: !reduce });
  return <div className={className}>{Math.round(v)}</div>;
});

const SourceVerificationPanel = memo(function SourceVerificationPanel({ verified, excluded }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 text-left" aria-expanded={open}>
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-rag-green" />
              <span className="font-serif text-lg">Source Verification</span>
              <Badge variant="secondary">{verified.length} verified</Badge>
              {excluded.length > 0 && <Badge variant="outline">{excluded.length} excluded</Badge>}
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-2 sm:px-5 pb-5 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-center">Year</TableHead>
                  <TableHead className="text-right">Verified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verified.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.metric}</TableCell>
                    <TableCell className="tabular-nums">{r.value}</TableCell>
                    <TableCell>
                      <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                        {r.source} <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell className="text-center">{r.year}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{verifiedAtLabel()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
});

export default PerformanceSnapshotView;
