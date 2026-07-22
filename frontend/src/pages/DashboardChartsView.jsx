import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line, PieChart, Pie, Cell,
  RadialBarChart, RadialBar,
} from "recharts";
import PerformanceBadge from "../components/PerformanceBadge";
import FilterBar, { applyObjectiveFilter } from "../components/FilterBar";
import { useScorecard } from "../context/ScorecardContext";
import { PERSPECTIVES, PERSPECTIVE_MAP, isQuarterPeriod, comparePeriods, isReported } from "../lib/constants";
import {
  overallScore, perspectiveScore, objectiveScore, measureAchievement, achievementPct, fmtPct, overallRating, measureRating,
} from "../lib/calculations";
import { useTheme } from "../context/ThemeProvider";

const PALETTE_LIGHT = ["#721B29", "#9F5E46", "#C6A87C", "#5A2E2E", "#8A2A3D", "#B37B5A", "#3B0A12", "#D8BC94"];
const PALETTE_DARK = ["#9B2A3E", "#B8755D", "#D8BC94", "#8A4A56", "#C56078", "#E5A122", "#4A9B61", "#E85656"];

const DashboardChartsView = ({ filters, setFilters }) => {
  const { project } = useScorecard();
  const { theme } = useTheme();
  const palette = theme === "dark" ? PALETTE_DARK : PALETTE_LIGHT;
  const gridStroke = theme === "dark" ? "#4A373A" : "#E5DFDA";
  const textColor = theme === "dark" ? "#F4EFEA" : "#1A1213";

  const filteredObjectives = useMemo(
    () => project.objectives.filter((o) => applyObjectiveFilter(project, o, filters)),
    [project, filters]
  );
  const objIdSet = new Set(filteredObjectives.map((o) => o.id));
  const filteredMeasures = project.measures.filter((m) => objIdSet.has(m.objective_id));
  const filteredMids = new Set(filteredMeasures.map((m) => m.id));
  const filteredTargets = project.targets.filter((t) => filteredMids.has(t.measure_id));

  const subProject = { ...project, objectives: filteredObjectives, measures: filteredMeasures, targets: filteredTargets };

  const overall = overallScore(subProject);

  // Radar: perspective balance
  const radarData = PERSPECTIVES.map((p) => ({
    perspective: p.short,
    score: Number(perspectiveScore(p.id, filteredObjectives, filteredMeasures, filteredTargets).toFixed(1)),
    fullMark: 100,
  }));

  // Bar: department scores
  const departmentData = project.departments.map((d) => {
    const oids = filteredObjectives.filter((o) => o.department_id === d.id);
    const s = oids.reduce((a, o) => a + objectiveScore(o, filteredMeasures, filteredTargets) * ((Number(o.weight) || 0) / 100), 0);
    return { name: d.name, score: Number(s.toFixed(1)) };
  }).filter((d) => d.score > 0 || filteredObjectives.some((o) => o.department_id));

  // Trend: average achievement quarter by quarter.
  //
  // Quarters only. An annual FY row is one dot on a different timescale, and
  // drawing a line from "Q3 FY25" to "FY25" would join two things that are not
  // comparable -- the annual row already contains its own quarters.
  //
  // Achievement goes through achievementPct rather than actual/target, so
  // lower-is-better measures invert properly. Net Debt/EBITDA of 4.2 against a
  // 3.5 target is 83%, and the old raw division called it 120%.
  //
  // Unreported quarters are skipped entirely. A Q4 row created in advance has a
  // target but no actual, and averaging it in as zero would show a collapse
  // that has not happened.
  const measureById = new Map(filteredMeasures.map((m) => [m.id, m]));
  const quarterMap = {};
  for (const t of filteredTargets) {
    if (!isQuarterPeriod(t.period) || !isReported(t)) continue;
    const pct = achievementPct(t.actual_value, t.target_value, measureById.get(t.measure_id)?.direction);
    if (!Number.isFinite(pct)) continue;
    (quarterMap[t.period] = quarterMap[t.period] || []).push(pct);
  }
  const trendData = Object.entries(quarterMap)
    .map(([period, arr]) => ({
      period,
      avg: Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)),
      measures: arr.length,
    }))
    .sort((a, b) => comparePeriods(a.period, b.period));

  const quarterlyMeasureCount = filteredMeasures.filter((m) => m.time_period === "Quarterly").length;

  // Pie: perspective weight allocation
  const weightPie = PERSPECTIVES.map((p, i) => ({
    name: p.short,
    value: Number(project.perspective_weights?.[p.id]) || 0,
    fill: palette[i % palette.length],
  }));

  // Radial gauge: overall
  const gaugeData = [{ name: "Overall", value: Number(overall.toFixed(1)), fill: overall < (project.performance_thresholds?.red_max ?? 70) ? "#D93838" : overall < (project.performance_thresholds?.amber_max ?? 90) ? "#D98A29" : "#35824C" }];

  // KPI cards: top-3 wins & losses
  const measurePerf = filteredMeasures.map((m) => ({ m, pct: measureAchievement(m, filteredTargets) }));
  const wins = [...measurePerf].sort((a, b) => b.pct - a.pct).slice(0, 3);
  const losses = [...measurePerf].filter((x) => x.pct < 100).sort((a, b) => a.pct - b.pct).slice(0, 3);

  const totalObjectives = filteredObjectives.length;
  const totalMeasures = filteredMeasures.length;
  const initiativesInScope = project.initiatives.filter((i) => (i.measure_ids || []).some((id) => filteredMids.has(id)));
  const avgInitiativeProgress = initiativesInScope.length
    ? initiativesInScope.reduce((a, i) => a + (Number(i.progress) || 0), 0) / initiativesInScope.length
    : 0;

  return (
    <div className="space-y-6" data-testid="dashboard-charts">
      <FilterBar filters={filters} setFilters={setFilters} />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Overall balanced score" value={fmtPct(overall)} pct={overall} thresholds={project.performance_thresholds} testId="stat-overall" />
        <StatCard label="Objectives in scope" value={totalObjectives} />
        <StatCard label="Measures tracked" value={totalMeasures} />
        <StatCard label="Avg. initiative progress" value={fmtPct(avgInitiativeProgress, 0)} />
      </div>

      {/* Chart grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Radar */}
        <Card className="p-5 xl:col-span-1">
          <ChartHead title="Perspective balance" subtitle="Score % across 4 perspectives" />
          <div className="h-64">
            <ResponsiveContainer>
              <RadarChart data={radarData}>
                <PolarGrid stroke={gridStroke} />
                <PolarAngleAxis dataKey="perspective" tick={{ fill: textColor, fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: textColor, fontSize: 10 }} />
                <Radar dataKey="score" stroke={palette[0]} fill={palette[0]} fillOpacity={0.35} />
                <Tooltip contentStyle={{ background: theme === "dark" ? "#24191A" : "#fff", border: `1px solid ${gridStroke}`, borderRadius: 8 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Overall gauge */}
        <Card className="p-5">
          <ChartHead title="Overall" subtitle="Weighted balanced score" />
          <div className="h-64 relative">
            <ResponsiveContainer>
              <RadialBarChart innerRadius="65%" outerRadius="100%" data={gaugeData} startAngle={220} endAngle={-40}>
                <RadialBar dataKey="value" cornerRadius={12} background={{ fill: gridStroke, opacity: 0.4 }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="font-serif text-4xl tabular-nums">{overall.toFixed(1)}%</div>
              <PerformanceBadge pct={overall} rating={overallRating(subProject)} thresholds={project.performance_thresholds} showLabel={false} />
            </div>
          </div>
        </Card>

        {/* Pie: perspective weights */}
        <Card className="p-5">
          <ChartHead title="Weight allocation" subtitle="How each perspective is weighted" />
          {/*
            The legend is plain HTML below the chart rather than a <Legend> inside
            the SVG. Recharts measures an in-SVG legend and subtracts it from the
            plot area; with four wrapped entries that left a 14x14 drawing surface
            in a 247x256 card, so the pie rendered as a sliver.
          */}
          <div className="h-44">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={weightPie} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                  {weightPie.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip
                  formatter={(v, n) => [`${v}%`, n]}
                  contentStyle={{ background: theme === "dark" ? "#24191A" : "#fff", border: `1px solid ${gridStroke}`, borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {weightPie.map((entry) => (
              <li key={entry.name} className="flex items-center gap-1.5 min-w-0">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.fill }} aria-hidden />
                <span className="truncate">{entry.name}</span>
                <span className="ml-auto tabular-nums text-foreground">{entry.value}%</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Bar: departments */}
        <Card className="p-5 xl:col-span-2">
          <ChartHead title="Department scores" subtitle="Weighted score by department" />
          <div className="h-64">
            {departmentData.length === 0 ? (
              <EmptyChart msg="Assign departments to objectives to see scores here." />
            ) : (
              <ResponsiveContainer>
                <BarChart data={departmentData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <XAxis dataKey="name" tick={{ fill: textColor, fontSize: 11 }} />
                  <YAxis tick={{ fill: textColor, fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: theme === "dark" ? "#24191A" : "#fff", border: `1px solid ${gridStroke}`, borderRadius: 8 }} />
                  <Bar dataKey="score" fill={palette[1]} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Trend */}
        <Card className="p-5">
          <ChartHead title="Quarterly achievement trend" subtitle="Average % by quarter" />
          <div className="h-64">
            {trendData.length < 2 ? (
              <EmptyChart
                msg={
                  trendData.length === 1
                    ? `Only ${trendData[0].period} has reported actuals — a trend needs at least two quarters.`
                    : quarterlyMeasureCount === 0
                      ? "No quarterly measures in scope. Set a measure's time period to Quarterly, then add Q1–Q4 targets."
                      : "Quarterly measures are set up, but no quarter has an actual reported yet."
                }
              />
            ) : (
              <ResponsiveContainer>
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <XAxis dataKey="period" tick={{ fill: textColor, fontSize: 11 }} />
                  <YAxis tick={{ fill: textColor, fontSize: 11 }} domain={[0, 120]} />
                  <Tooltip
                    contentStyle={{ background: theme === "dark" ? "#24191A" : "#fff", border: `1px solid ${gridStroke}`, borderRadius: 8 }}
                    formatter={(v, _n, item) => [`${v}% across ${item?.payload?.measures ?? 0} measure${item?.payload?.measures === 1 ? "" : "s"}`, "Achievement"]}
                  />
                  <Line type="monotone" dataKey="avg" stroke={palette[0]} strokeWidth={2.5} dot={{ r: 3, fill: palette[0] }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Top wins/losses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <ChartHead title="Top wins" subtitle="Highest-performing measures" />
          <MeasureList items={wins} project={project} />
        </Card>
        <Card className="p-5">
          <ChartHead title="Needs attention" subtitle="Lowest-performing measures" />
          <MeasureList items={losses} project={project} />
        </Card>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, pct, thresholds, testId }) => (
  <Card className="p-5" data-testid={testId}>
    <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{label}</div>
    <div className="mt-2 flex items-baseline gap-2">
      <div className="font-serif text-3xl tabular-nums">{value}</div>
      {typeof pct === "number" && <PerformanceBadge pct={pct} thresholds={thresholds} showLabel={false} />}
    </div>
  </Card>
);

const ChartHead = ({ title, subtitle }) => (
  <div className="mb-3">
    <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{subtitle}</div>
    <h3 className="font-serif text-lg leading-tight">{title}</h3>
  </div>
);

const EmptyChart = ({ msg }) => (
  <div className="h-full flex items-center justify-center text-sm text-muted-foreground italic">{msg}</div>
);

const MeasureList = ({ items, project }) => {
  if (items.length === 0) return <div className="text-sm text-muted-foreground italic py-6 text-center">Not enough data yet.</div>;
  return (
    <div className="space-y-3">
      {items.map(({ m, pct }) => {
        const o = project.objectives.find((x) => x.id === m.objective_id);
        return (
          <div key={m.id} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{m.name}</div>
              <div className="text-xs text-muted-foreground truncate">{o?.name || "—"} · {PERSPECTIVE_MAP[o?.perspective_id]?.short || "—"}</div>
            </div>
            <div className="text-right">
              <div className="tabular-nums font-medium text-sm">{pct.toFixed(1)}%</div>
              <PerformanceBadge pct={pct} rating={measureRating(m, project.targets, project.performance_thresholds)} thresholds={project.performance_thresholds} showLabel={false} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DashboardChartsView;
