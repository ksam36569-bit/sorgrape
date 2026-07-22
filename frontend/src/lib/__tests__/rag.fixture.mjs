// Regression guard: the workbook is the source of truth for RAG status.
//
// Run from the repo root:  node frontend/src/lib/__tests__/rag.fixture.mjs
//
// Every status in frontend/src/data/sogrape-fy25.json must match what the source workbook
// reported. Seven of these disagree with the old achievement-band rule, so this
// will catch anyone reverting measureRating() back to percentage banding.

import { readFileSync } from "fs";
import { measureRating, objectiveRating, perspectiveRating, measureAchievement, rating, objectiveScore } from "../calculations.js";

const project  = JSON.parse(readFileSync("frontend/src/data/sogrape-fy25.json", "utf8"));
const expected = JSON.parse(readFileSync("data/expected-rag.json", "utf8"));
const byName   = Object.fromEntries(expected.map((e) => [e.measure, e.expected_rag]));

console.log("Reproducing every RAG status from the workbook\n");
console.log(`${"measure".padEnd(42)} ${"sheet".padEnd(7)} ${"app".padEnd(7)} ${"old band".padEnd(9)}`);
console.log("-".repeat(70));

let pass = 0, fail = 0, wouldHaveBeenWrong = 0;
for (const m of project.measures) {
  const want = byName[m.name];
  const got  = measureRating(m, project.targets, project.performance_thresholds);
  const old  = rating(measureAchievement(m, project.targets), project.performance_thresholds);
  const ok   = want === got;
  if (ok) pass++; else fail++;
  if (old !== want) wouldHaveBeenWrong++;
  const flag = ok ? " " : "  <-- MISMATCH";
  console.log(`${m.name.slice(0,40).padEnd(42)} ${want.padEnd(7)} ${got.padEnd(7)} ${old.padEnd(9)}${flag}`);
}

console.log("\n--- RAG Summary vs the workbook's own summary sheet ---");
const SHEET_SUMMARY = { financial:[0,4,2], customer:[1,5,0], internal:[1,4,1], learning:[0,5,1] };
const names = { financial:"Financial", customer:"Customer", internal:"Internal Process", learning:"Learning & Growth" };
let summaryFail = 0;
for (const [pid, label] of Object.entries(names)) {
  const ms = project.measures.filter((m) =>
    project.objectives.find((o) => o.id === m.objective_id)?.perspective_id === pid);
  const c = { green:0, amber:0, red:0 };
  for (const m of ms) c[measureRating(m, project.targets, project.performance_thresholds)]++;
  const got = [c.green, c.amber, c.red];
  const want = SHEET_SUMMARY[pid];
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) summaryFail++;
  console.log(`  ${label.padEnd(20)} G/A/R app=${got.join("/")}  sheet=${want.join("/")}  ${ok?"match":"MISMATCH"}`);
}


// --- a parent must never look healthier than its worst child ---------------
console.log("\n--- rollup consistency ---");
const ORDER = { green: 0, amber: 1, red: 2 };
let rollupFail = 0;
for (const o of project.objectives) {
  const kids = project.measures.filter((m) => m.objective_id === o.id)
    .map((m) => measureRating(m, project.targets, project.performance_thresholds));
  const got = objectiveRating(o, project.measures, project.targets, project.performance_thresholds);
  const worst = kids.reduce((w, r) => (ORDER[r] > ORDER[w] ? r : w), "green");
  const band = rating(objectiveScore(o, project.measures, project.targets), project.performance_thresholds);
  if (got !== worst) { rollupFail++; console.log(`  MISMATCH ${o.name}: ${got} vs worst child ${worst}`); }
  if (band !== worst) console.log(`  (band would have said ${band}, measures say ${worst}) ${o.name.slice(0,44)}`);
}
for (const pid of ["financial","customer","internal","learning"]) {
  const objs = project.objectives.filter((o) => o.perspective_id === pid);
  const worst = objs.map((o) => objectiveRating(o, project.measures, project.targets, project.performance_thresholds))
    .reduce((w, r) => (ORDER[r] > ORDER[w] ? r : w), "green");
  const got = perspectiveRating(pid, project.objectives, project.measures, project.targets, project.performance_thresholds);
  if (got !== worst) { rollupFail++; console.log(`  MISMATCH perspective ${pid}: ${got} vs ${worst}`); }
}
console.log(rollupFail === 0
  ? "  every objective and perspective matches its worst child"
  : `  ${rollupFail} rollup mismatches`);

console.log(`\n${pass}/${project.measures.length} RAG statuses match the workbook, ${fail} mismatched`);
console.log(`${wouldHaveBeenWrong} would have been wrong under the old achievement-band rule`);
process.exit(fail || summaryFail || rollupFail ? 1 : 0);
