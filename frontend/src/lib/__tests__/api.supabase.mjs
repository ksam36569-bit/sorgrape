// Data-layer tests against an in-memory stand-in for Supabase that emulates the
// FK cascades and the (measure_id, period) unique index the migration declares.
//
// Run from the repo root:
//   node frontend/src/lib/__tests__/api.supabase.mjs
import { api, supabase } from "./harness.mjs";

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? "PASS  " : "FAIL  ") + name);
  if (!ok) { console.log("   want:", JSON.stringify(want)); console.log("   got :", JSON.stringify(got)); fail++; } else pass++;
};
const ok = (name, cond, detail="") => {
  console.log((cond ? "PASS  " : "FAIL  ") + name);
  if (!cond) { if (detail) console.log("   " + detail); fail++; } else pass++;
};

// ---- project shape -------------------------------------------------------
let p = await api.createProject({ company_name: "Sogrape", industry: "Wine", departments: ["Sales","Ops"] });
ok("createProject returns the document shape",
   p.perspectives?.length === 4 && p.departments.length === 2 && Array.isArray(p.strategy_edges),
   JSON.stringify(Object.keys(p)));
eq("default perspective weights preserved", p.perspective_weights, {financial:25,customer:25,internal:25,learning:25});

const list = await api.listProjects();
eq("listProjects summary counts", [list.length, list[0].objectives_count, list[0].measures_count], [1,0,0]);

// ---- cascade behaviour ---------------------------------------------------
const o = await api.addObjective(p.id, { name:"Grow revenue", perspective_id:"financial", weight:100 });
const m = await api.addMeasure(p.id, { name:"Net revenue", objective_id:o.id, weight:100 });
await api.addTarget(p.id, { measure_id:m.id, period:"Q1", target_value:100, actual_value:123 });
p = await api.getProject(p.id);
eq("nested rows land on the project", [p.objectives.length,p.measures.length,p.targets.length], [1,1,1]);

await api.deleteObjective(p.id, o.id);
p = await api.getProject(p.id);
eq("deleting an objective cascades to measures and targets",
   [p.objectives.length,p.measures.length,p.targets.length], [0,0,0]);

// deleting a department unassigns, does not delete
const d = p.departments[0];
const o2 = await api.addObjective(p.id, { name:"Retain customers", perspective_id:"customer", department_id:d.id, weight:50 });
await api.deleteDepartment(p.id, d.id);
p = await api.getProject(p.id);
ok("deleting a department unassigns its objectives",
   p.objectives.length === 1 && p.objectives[0].department_id === null,
   JSON.stringify(p.objectives.map(x=>x.department_id)));

// ---- bulk import: add mode ----------------------------------------------
let r = await api.bulkImport(p.id, { mode:"add",
  departments:[{name:"Finance"},{name:"Finance"}],           // dedupes
  objectives:[{name:"Boost margin", perspective:"Financial", department:"Finance", weight:60}],
  measures:[{name:"Gross margin", objective:"Boost margin", weight:100, unit:"%"}],
  targets:[{measure:"Gross margin", period:"Q1", target_value:40, actual_value:38}],
  initiatives:[{name:"Cost programme", measures:"Gross margin", progress:25}],
});
p = r.project;
ok("bulk add resolves names to ids",
   p.objectives.find(x=>x.name==="Boost margin")?.perspective_id === "financial" &&
   p.measures[0].objective_id === p.objectives.find(x=>x.name==="Boost margin").id &&
   p.targets[0].measure_id === p.measures[0].id &&
   p.initiatives[0].measure_ids[0] === p.measures[0].id);
ok("duplicate department name imported once", p.departments.filter(x=>x.name==="Finance").length === 1);
eq("add mode counts", r.stats, { created: 5, updated: 0 });

// ---- bulk import: add mode must not touch existing rows -------------------
r = await api.bulkImport(p.id, { mode:"add", objectives:[{name:"Boost margin", weight:999}] });
p = r.project;
eq("add mode leaves an existing objective alone",
   [p.objectives.find(x=>x.name==="Boost margin").weight, r.stats.updated], [60, 0]);

// ---- bulk import: update mode -------------------------------------------
r = await api.bulkImport(p.id, { mode:"update",
  objectives:[{name:"Boost margin", weight:75, perspective:"Financial"}],
  targets:[{measure:"Gross margin", period:"Q1", target_value:45, actual_value:44}],
});
p = r.project;
eq("update mode overwrites in place",
   [p.objectives.find(x=>x.name==="Boost margin").weight,
    Number(p.targets.find(t=>t.period==="Q1").target_value),
    p.targets.length],
   [75, 45, 1]);

// ---- bulk import: replace mode ------------------------------------------
r = await api.bulkImport(p.id, { mode:"replace",
  departments:[{name:"Only Dept"}],
  objectives:[{name:"Only Objective", perspective:"Customer", weight:100}],
});
p = r.project;
eq("replace wipes prior content",
   [p.departments.length, p.objectives.length, p.measures.length, p.targets.length, p.initiatives.length],
   [1, 1, 0, 0, 0]);
eq("replace kept the new rows", [p.departments[0].name, p.objectives[0].name], ["Only Dept","Only Objective"]);

// ---- update actuals ------------------------------------------------------
const m2 = await api.addMeasure(p.id, { name:"NPS", objective_id:p.objectives[0].id, weight:100 });
await api.addTarget(p.id, { measure_id:m2.id, period:"Q1", target_value:50, actual_value:0 });
const ua = await api.updateActuals(p.id, [
  { measure:"NPS", period:"Q1", actual_value:47 },   // updates
  { measure:"NPS", period:"Q2", actual_value:52 },   // creates
  { measure:"Nonexistent", period:"Q1", actual_value:1 }, // skipped
]);
eq("updateActuals counts", { updated: ua.updated, created: ua.created }, { updated: 1, created: 1 });
const q1 = ua.project.targets.find(t=>t.measure_id===m2.id && t.period==="Q1");
const q2 = ua.project.targets.find(t=>t.measure_id===m2.id && t.period==="Q2");
eq("updateActuals values", [Number(q1.actual_value), Number(q2.actual_value), Number(q2.target_value)], [47, 52, 0]);

// ---- duplicate / import remap -------------------------------------------
const dup = await api.duplicateProject(p.id);
ok("duplicate names the copy", dup.company_name === "Sogrape (Copy)");
ok("duplicate deep-copies children",
   dup.objectives.length === p.objectives.length && dup.measures.length >= 1 && dup.id !== p.id);
ok("duplicate remaps foreign keys to the new rows",
   dup.measures.every(mm => dup.objectives.some(oo => oo.id === mm.objective_id)) &&
   dup.targets.every(tt => dup.measures.some(mm => mm.id === tt.measure_id)),
   JSON.stringify({objs:dup.objectives.map(x=>x.id), meas:dup.measures.map(x=>x.objective_id)}));
ok("duplicate shares no ids with the original",
   !dup.objectives.some(a => p.objectives.some(b => b.id === a.id)));

// strategy edges survive a duplicate with remapped endpoints
await api.addObjective(dup.id, { name:"Second", perspective_id:"learning", weight:0 });
let d2 = await api.getProject(dup.id);
await api.addStrategyEdge(dup.id, d2.objectives[0].id, d2.objectives[1].id, "drives");
d2 = await api.getProject(dup.id);
const dup2 = await api.duplicateProject(dup.id);
ok("strategy edges remap on duplicate",
   dup2.strategy_edges.length === 1 &&
   dup2.objectives.some(o => o.id === dup2.strategy_edges[0].source) &&
   dup2.objectives.some(o => o.id === dup2.strategy_edges[0].target));

// ---- delete project cleans up -------------------------------------------
await api.deleteProject(dup2.id);
ok("deleting a project cascades every child",
   !supabase.db.objectives.some(x=>x.project_id===dup2.id) &&
   !supabase.db.measures.some(x=>x.project_id===dup2.id) &&
   !supabase.db.strategy_edges.some(x=>x.project_id===dup2.id));


// --- columns added after this layer was written --------------------------
const om = await api.addObjective(p.id, { name:"Debt discipline", perspective_id:"financial", weight:100 });
const lower = await api.addMeasure(p.id, { name:"Net Debt / EBITDA", objective_id: om.id, weight:100,
  direction:"lower", green_threshold:3.5, amber_threshold:4.5, unit:"x" });
ok("direction and thresholds round-trip through the data layer",
   lower.direction==="lower" && Number(lower.green_threshold)===3.5 && Number(lower.amber_threshold)===4.5,
   JSON.stringify(lower));
const reread = (await api.getProject(p.id)).measures.find(m=>m.id===lower.id);
ok("they survive a re-read", reread.direction==="lower" && Number(reread.amber_threshold)===4.5);
const upd = await api.updateMeasure(p.id, lower.id, { ...lower, direction:"higher", green_threshold:9 });
ok("they can be edited", upd.direction==="higher" && Number(upd.green_threshold)===9);
const dupd = await api.duplicateProject(p.id);
const dm = dupd.measures.find(m=>m.name==="Net Debt / EBITDA");
ok("they carry through a duplicate", dm && dm.direction==="higher" && Number(dm.green_threshold)===9);


// --- OKRs -----------------------------------------------------------------
const okrA = await api.addOkr(p.id, { title:"Premiumise the portfolio", owner:"Commercial" });
const okrB = await api.addOkr(p.id, { title:"Consolidate Iberia", owner:"Iberia" });
const okrC = await api.addOkr(p.id, { title:"Accelerate STEP", owner:"TO" });
eq("new OKRs append in order", [okrA.position,okrB.position,okrC.position], [0,1,2]);

const krA = await api.addKeyResult(p.id, okrA.id, { description:"Fine Wines share", baseline:18, current_value:20, target:25, unit:"%" });
const krB = await api.addKeyResult(p.id, okrA.id, { description:"ASP uplift", baseline:0, current_value:3, target:6 });
eq("key results append within their OKR", [krA.position,krB.position], [0,1]);
ok("a key result belongs to its OKR", krA.okr_id===okrA.id);

let okrProj = await api.getProject(p.id);
eq("OKRs and key results load with the project", [okrProj.okrs.length, okrProj.key_results.length], [3,2]);
eq("OKRs come back in position order", okrProj.okrs.map(o=>o.title), ["Premiumise the portfolio","Consolidate Iberia","Accelerate STEP"]);

await api.reorderOkrs(p.id, [okrC.id, okrA.id, okrB.id]);
okrProj = await api.getProject(p.id);
eq("reordering persists", okrProj.okrs.map(o=>o.title), ["Accelerate STEP","Premiumise the portfolio","Consolidate Iberia"]);

const krEdited = await api.updateKeyResult(p.id, krA.id, { description:"Fine Wines share of revenue", current_value:22, status_override:"amber", owner:"Commercial", due_date:"2026-12-31" });
eq("key result edits persist", [krEdited.description, Number(krEdited.current_value), krEdited.status_override, krEdited.due_date],
   ["Fine Wines share of revenue", 22, "amber", "2026-12-31"]);
ok("OKR title edits persist", (await api.updateOkr(p.id, okrA.id, { title:"Premiumise for value growth" })).title.endsWith("value growth"));

await api.deleteKeyResult(p.id, krB.id);
okrProj = await api.getProject(p.id);
eq("deleting a key result leaves its OKR alone", [okrProj.okrs.length, okrProj.key_results.length], [3,1]);

await api.deleteOkr(p.id, okrA.id);
okrProj = await api.getProject(p.id);
eq("deleting an OKR takes its key results with it", [okrProj.okrs.length, okrProj.key_results.length], [2,0]);

const okrX = await api.addOkr(p.id, { title:"Carry me" });
await api.addKeyResult(p.id, okrX.id, { description:"KR", baseline:0, current_value:1, target:2 });
const dupOkr = await api.duplicateProject(p.id);
ok("OKRs and key results survive a duplicate", dupOkr.okrs.length===3 && dupOkr.key_results.length===1);
ok("duplicated key results point at the duplicated OKR",
   dupOkr.key_results.every(k => dupOkr.okrs.some(o => o.id===k.okr_id)) && !dupOkr.okrs.some(o => o.id===okrX.id));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
