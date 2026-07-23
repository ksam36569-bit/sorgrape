// Verification engine + dataset integrity for the Performance Snapshot tab.
// Run: node frontend/src/lib/__tests__/performance.logic.mjs
import {
  METRICS, SOURCES, SUSTAINABILITY_SCORE, verifyMetric, buildVerification,
  seriesFor, buildExportPayload, sourcesUsed, latestDisplay, snapshotYears,
} from "../performanceSnapshot.js";

let pass = 0, fail = 0;
const ok = (n, cond) => { console.log((cond ? "PASS  " : "FAIL  ") + n); cond ? pass++ : fail++; };
const eq = (n, g, w) => ok(n + `  (got ${JSON.stringify(g)})`, JSON.stringify(g) === JSON.stringify(w));

// ---- verifyMetric contract
const good = verifyMetric("Waste Recovery Rate", "97.89%", "report_2024", 2024);
ok("valid metric verifies", good.verified === true);
ok("record carries source label", good.source === SOURCES.report_2024.label);
ok("record carries source url", good.sourceUrl === SOURCES.report_2024.url);
ok("record carries year", good.year === 2024);
ok("record carries verifiedAt", typeof good.verifiedAt === "string" && good.verifiedAt.length > 0);

ok("missing value fails", verifyMetric("X", "", "report_2024", 2024).verified === false);
ok("missing source fails", verifyMetric("X", "1", null, 2024).verified === false);
ok("missing year fails", verifyMetric("X", "1", "report_2024", null).verified === false);
ok("unknown source id fails", verifyMetric("X", "1", "does_not_exist", 2024).verified === false);

// ---- full dataset
eq("14 metrics in dataset", METRICS.length, 14);
const { verified, excluded, log } = buildVerification();
eq("all 14 verify, none excluded", [verified.length, excluded.length], [14, 0]);
ok("every metric appears in the panel", verified.length === METRICS.length);
ok("every verified record has source+year+verifiedAt", verified.every((r) => r.source && r.year && r.verifiedAt));
ok("log has one entry per metric", log.length === METRICS.length);
ok("no failed-verification log lines", log.every((l) => l.level === "info"));
ok("score is 88", SUSTAINABILITY_SCORE === 88);

// ---- no fabricated data: null numerics are never plotted
const ghg = seriesFor("ghg_reduction");
eq("GHG series has 2 points (2023 'Improving' omitted)", ghg.map((p) => p.year), ["2022", "2024"]);
const scope2 = seriesFor("scope2_reduction");
eq("Scope 2 series has 2 points", scope2.map((p) => p.year), ["2022", "2024"]);
const waste = seriesFor("waste_recovery_rate");
eq("Waste recovery has 3 points", waste.map((p) => p.value), [97, 97, 97.89]);
ok("no NaN in any plotted series", [...ghg, ...scope2, ...waste].every((p) => typeof p.value === "number" && !Number.isNaN(p.value)));

// ---- latest disclosed value picks the newest year present
eq("packaging latest is 2024/57%", latestDisplay(METRICS.find((m) => m.id === "packaging_recyclability")), { year: 2024, value: "57%" });
eq("countries latest is 2024/120+", latestDisplay(METRICS.find((m) => m.id === "countries_served")), { year: 2024, value: "120+" });

// ---- corroborated-on-site subset (checked live against sogrape.com)
const onSite = METRICS.filter((m) => m.corroboratedOnSite).map((m) => m.id).sort();
eq("site-corroborated subset", onSite, ["co2_avoided", "countries_served", "innovation_projects", "rainfed_vineyards", "strategic_partnerships"]);

// ---- export payload shape
const payload = buildExportPayload();
ok("payload has metrics array", Array.isArray(payload.metrics) && payload.metrics.length === 14);
ok("payload has sources array", Array.isArray(payload.sources) && payload.sources.length > 0);
ok("payload has verificationLog array", Array.isArray(payload.verificationLog) && payload.verificationLog.length === 14);
ok("payload keys present", ["metrics", "sources", "verificationLog"].every((k) => k in payload));
ok("every source has a url", sourcesUsed().every((s) => /^https?:\/\//.test(s.url)));
eq("snapshot years are 2022..2024", snapshotYears(), [2022, 2023, 2024]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
