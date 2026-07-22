import { db, newId, nowIso } from "./store";

// Data layer. Everything is stored locally in the browser — see store.js.
//
// Each project is one self-contained document holding its own departments,
// objectives, measures, targets, initiatives and strategy edges. That is the
// shape the UI has always consumed, so these method signatures are unchanged
// from when this talked to a REST backend; no calling component knows the
// difference.

export const BASE = "";

// The four Balanced Scorecard perspectives are fixed by the framework.
export const PERSPECTIVES = [
  { id: "financial", name: "Financial" },
  { id: "customer", name: "Customer" },
  { id: "internal", name: "Internal Business Processes" },
  { id: "learning", name: "Learning & Growth" },
];

const DEFAULTS = {
  perspective_weights: { financial: 25, customer: 25, internal: 25, learning: 25 },
  performance_thresholds: { red_max: 70, amber_max: 90 },
};

const COLLECTIONS = [
  "departments",
  "objectives",
  "measures",
  "targets",
  "initiatives",
  "strategy_edges",
];

const num = (v) => Number(v ?? 0) || 0;

/** Case-insensitive name match, used by the spreadsheet importers. */
function findByName(items, name) {
  const target = String(name ?? "").trim().toLowerCase();
  return items.find((it) => String(it.name ?? "").trim().toLowerCase() === target) || null;
}

async function load(id) {
  const project = await db.get(id);
  if (!project) throw new Error("Project not found");
  // Older saves may predate a collection being added.
  for (const c of COLLECTIONS) if (!Array.isArray(project[c])) project[c] = [];
  project.perspectives = PERSPECTIVES;
  return project;
}

async function save(project) {
  project.updated_at = nowIso();
  await db.put(project);
  return project;
}

/** Strip fields the caller must not set directly. */
function fields(payload, drop = ["id"]) {
  const out = { ...payload };
  for (const k of drop) delete out[k];
  return out;
}

/** Add to a collection, returning the created row. */
async function addTo(pid, collection, values) {
  const project = await load(pid);
  const row = { id: newId(), ...fields(values) };
  project[collection].push(row);
  await save(project);
  return row;
}

/** Patch a row in place, returning it. Throws if it isn't there. */
async function patchIn(pid, collection, rowId, values) {
  const project = await load(pid);
  const row = project[collection].find((r) => r.id === rowId);
  if (!row) throw new Error("Not found");
  Object.assign(row, fields(values));
  await save(project);
  return row;
}

export const api = {
  // ------------------------------------------------------------- projects

  listProjects: async () => {
    const rows = await db.all();
    return rows
      .map((d) => ({
        id: d.id,
        company_name: d.company_name,
        industry: d.industry ?? "",
        fiscal_year: d.fiscal_year ?? "",
        business_unit: d.business_unit ?? "",
        updated_at: d.updated_at,
        created_at: d.created_at,
        objectives_count: (d.objectives || []).length,
        measures_count: (d.measures || []).length,
      }))
      .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  },

  createProject: async (payload) => {
    const { departments = [], ...rest } = payload || {};
    const project = {
      id: newId(),
      company_name: rest.company_name,
      industry: rest.industry || "",
      fiscal_year: rest.fiscal_year || "",
      business_unit: rest.business_unit || "",
      vision: rest.vision || "",
      mission: rest.mission || "",
      strategic_themes: rest.strategic_themes || "",
      prepared_by: rest.prepared_by || "",
      prepared_date: rest.prepared_date || "",
      perspectives: PERSPECTIVES,
      perspective_weights: { ...DEFAULTS.perspective_weights },
      performance_thresholds: { ...DEFAULTS.performance_thresholds },
      departments: departments.map((name) => ({ id: newId(), name })),
      objectives: [],
      measures: [],
      targets: [],
      initiatives: [],
      strategy_edges: [],
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await db.put(project);
    return project;
  },

  getProject: (id) => load(id),

  updateProject: async (id, payload) => {
    const project = await load(id);
    Object.assign(project, fields(payload, ["id", "created_at", ...COLLECTIONS]));
    return save(project);
  },

  deleteProject: async (id) => {
    await db.remove(id);
    return { ok: true };
  },

  duplicateProject: async (id) => {
    const src = await load(id);
    return api.importProject({ ...src, company_name: `${src.company_name} (Copy)` });
  },

  /**
   * Insert a project from an export file or a duplicate.
   *
   * Incoming rows carry their original ids, which would collide with the source
   * project. Every id is regenerated and the references between collections are
   * rewritten to match, so foreign keys, initiative links and strategy-map edges
   * all still point at the right rows.
   */
  importProject: async (doc) => {
    const src = doc || {};
    const remap = (rows) => {
      const map = new Map();
      const out = (rows || []).map((r) => {
        const id = newId();
        map.set(r.id, id);
        return { ...r, id };
      });
      return [out, map];
    };

    const [departments, deptMap] = remap(src.departments);
    const [objectives, objMap] = remap(src.objectives);
    const [measures, measureMap] = remap(src.measures);
    const [targets] = remap(src.targets);
    const [initiatives] = remap(src.initiatives);
    const [edges] = remap(src.strategy_edges);

    for (const o of objectives) o.department_id = deptMap.get(o.department_id) ?? null;
    for (const m of measures) m.objective_id = objMap.get(m.objective_id) ?? null;
    for (const i of initiatives) {
      i.measure_ids = (i.measure_ids || []).map((m) => measureMap.get(m)).filter(Boolean);
    }

    const project = {
      ...src,
      id: newId(),
      perspectives: PERSPECTIVES,
      perspective_weights: src.perspective_weights || { ...DEFAULTS.perspective_weights },
      performance_thresholds: src.performance_thresholds || { ...DEFAULTS.performance_thresholds },
      departments,
      objectives,
      measures,
      // Rows whose parent didn't survive the import are dropped rather than orphaned.
      targets: targets
        .filter((t) => measureMap.has(t.measure_id))
        .map((t) => ({ ...t, measure_id: measureMap.get(t.measure_id) })),
      initiatives,
      strategy_edges: edges
        .filter((e) => objMap.has(e.source) && objMap.has(e.target))
        .map((e) => ({ ...e, source: objMap.get(e.source), target: objMap.get(e.target) })),
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await db.put(project);
    return project;
  },

  // ---------------------------------------------------------- departments

  addDepartment: (pid, name) => addTo(pid, "departments", { name }),

  updateDepartment: (pid, did, name) => patchIn(pid, "departments", did, { name }),

  // Objectives are unassigned rather than deleted along with the department.
  deleteDepartment: async (pid, did) => {
    const project = await load(pid);
    project.departments = project.departments.filter((d) => d.id !== did);
    for (const o of project.objectives) if (o.department_id === did) o.department_id = null;
    await save(project);
    return { ok: true };
  },

  // ----------------------------------------------------------- objectives

  addObjective: (pid, payload) => addTo(pid, "objectives", payload),

  updateObjective: (pid, oid, payload) => patchIn(pid, "objectives", oid, payload),

  // Cascades to the objective's measures, their targets, and any strategy edges
  // touching it — the database used to do this, so it happens here now.
  deleteObjective: async (pid, oid) => {
    const project = await load(pid);
    const measureIds = project.measures.filter((m) => m.objective_id === oid).map((m) => m.id);
    project.objectives = project.objectives.filter((o) => o.id !== oid);
    project.measures = project.measures.filter((m) => m.objective_id !== oid);
    project.targets = project.targets.filter((t) => !measureIds.includes(t.measure_id));
    project.strategy_edges = project.strategy_edges.filter(
      (e) => e.source !== oid && e.target !== oid
    );
    await save(project);
    return { ok: true };
  },

  // ------------------------------------------------------------- measures

  addMeasure: (pid, payload) => addTo(pid, "measures", payload),

  updateMeasure: (pid, mid, payload) => patchIn(pid, "measures", mid, payload),

  deleteMeasure: async (pid, mid) => {
    const project = await load(pid);
    project.measures = project.measures.filter((m) => m.id !== mid);
    project.targets = project.targets.filter((t) => t.measure_id !== mid);
    for (const i of project.initiatives) {
      i.measure_ids = (i.measure_ids || []).filter((x) => x !== mid);
    }
    await save(project);
    return { ok: true };
  },

  // -------------------------------------------------------------- targets

  addTarget: (pid, payload) => addTo(pid, "targets", payload),

  updateTarget: (pid, tid, payload) => patchIn(pid, "targets", tid, payload),

  deleteTarget: async (pid, tid) => {
    const project = await load(pid);
    project.targets = project.targets.filter((t) => t.id !== tid);
    await save(project);
    return { ok: true };
  },

  // ---------------------------------------------------------- initiatives

  addInitiative: (pid, payload) => addTo(pid, "initiatives", payload),

  updateInitiative: (pid, iid, payload) => patchIn(pid, "initiatives", iid, payload),

  deleteInitiative: async (pid, iid) => {
    const project = await load(pid);
    project.initiatives = project.initiatives.filter((i) => i.id !== iid);
    await save(project);
    return { ok: true };
  },

  // ---------------------------------------------------------- bulk import

  /**
   * Spreadsheet import, with the original add / update / replace modes.
   *
   * Levels run parent-first because each resolves parent *names* to the ids
   * created by the level above — that is how a flat spreadsheet becomes a tree.
   */
  bulkImport: async (pid, payload) => {
    const project = await load(pid);
    const mode = payload?.mode || "add";
    const stats = { created: 0, updated: 0 };

    if (mode === "replace") for (const c of COLLECTIONS) project[c] = [];

    // -- departments (name is the only field, so never updated)
    for (const row of payload?.departments || []) {
      if (!row?.name) continue;
      if (findByName(project.departments, row.name)) continue;
      project.departments.push({ id: newId(), name: row.name });
      stats.created += 1;
    }

    // -- objectives
    for (const row of payload?.objectives || []) {
      if (!row?.name) continue;
      let perspectiveId = row.perspective_id;
      if (!perspectiveId && row.perspective) {
        const want = String(row.perspective).toLowerCase();
        perspectiveId = PERSPECTIVES.find(
          (p) => p.name.toLowerCase() === want || p.id.toLowerCase() === want
        )?.id;
      }
      let departmentId = row.department_id || null;
      if (!departmentId && row.department) {
        departmentId = findByName(project.departments, row.department)?.id ?? null;
      }
      const values = {
        name: row.name,
        description: row.description ?? "",
        priority: row.priority ?? "Medium",
        owner: row.owner ?? "",
        timeline: row.timeline ?? "",
        status: row.status ?? "On Track",
        color: row.color ?? "#721B29",
        department_id: departmentId,
        perspective_id: perspectiveId || "financial",
        weight: num(row.weight),
      };
      const existing = findByName(project.objectives, row.name);
      if (existing && mode !== "add") {
        Object.assign(existing, values);
        stats.updated += 1;
      } else if (!existing) {
        project.objectives.push({ id: newId(), ...values });
        stats.created += 1;
      }
    }

    // -- measures
    for (const row of payload?.measures || []) {
      if (!row?.name) continue;
      let objectiveId = row.objective_id || null;
      if (!objectiveId && row.objective) {
        objectiveId = findByName(project.objectives, row.objective)?.id ?? null;
      }
      const values = {
        name: row.name,
        description: row.description ?? "",
        unit: row.unit ?? "%",
        weight: num(row.weight),
        baseline: num(row.baseline),
        stretch_target: num(row.stretch_target),
        time_period: row.time_period ?? "Annual",
        owner: row.owner ?? "",
        data_source: row.data_source ?? "",
        comments: row.comments ?? "",
        objective_id: objectiveId,
      };
      const existing = findByName(project.measures, row.name);
      if (existing && mode !== "add") {
        Object.assign(existing, values);
        stats.updated += 1;
      } else if (!existing) {
        project.measures.push({ id: newId(), ...values });
        stats.created += 1;
      }
    }

    // -- targets, matched on (measure, period)
    for (const row of payload?.targets || []) {
      let measureId = row.measure_id || null;
      if (!measureId && row.measure) {
        measureId = findByName(project.measures, row.measure)?.id ?? null;
      }
      if (!measureId) continue;
      const period = row.period ?? "";
      const values = {
        measure_id: measureId,
        period,
        target_value: num(row.target_value),
        actual_value: num(row.actual_value),
      };
      const existing = project.targets.find(
        (t) => t.measure_id === measureId && t.period === period
      );
      if (existing && mode !== "add") {
        Object.assign(existing, values);
        stats.updated += 1;
      } else if (!existing) {
        project.targets.push({ id: newId(), ...values });
        stats.created += 1;
      }
    }

    // -- initiatives
    for (const row of payload?.initiatives || []) {
      if (!row?.name) continue;
      let measureIds = row.measure_ids || [];
      if (!measureIds.length && row.measures) {
        measureIds = String(row.measures)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((nm) => findByName(project.measures, nm)?.id)
          .filter(Boolean);
      }
      const values = {
        name: row.name,
        description: row.description ?? "",
        budget: num(row.budget),
        owner: row.owner ?? "",
        start_date: row.start_date ?? "",
        end_date: row.end_date ?? "",
        progress: num(row.progress),
        status: row.status ?? "Planned",
        risk_level: row.risk_level ?? "Low",
        expected_impact: row.expected_impact ?? "",
        dependencies: row.dependencies ?? "",
        measure_ids: measureIds,
      };
      const existing = findByName(project.initiatives, row.name);
      if (existing && mode !== "add") {
        Object.assign(existing, values);
        stats.updated += 1;
      } else if (!existing) {
        project.initiatives.push({ id: newId(), ...values });
        stats.created += 1;
      }
    }

    await save(project);
    return { stats, project };
  },

  /** Quick "update actuals" upload: sets actual_value per (measure, period). */
  updateActuals: async (pid, rows) => {
    const project = await load(pid);
    let updated = 0;
    let created = 0;

    for (const row of rows || []) {
      let measureId = row.measure_id || null;
      if (!measureId && row.measure) {
        measureId = findByName(project.measures, row.measure)?.id ?? null;
      }
      if (!measureId) continue;
      const period = row.period ?? "";
      const actual = num(row.actual_value);
      const existing = project.targets.find(
        (t) => t.measure_id === measureId && t.period === period
      );
      if (existing) {
        existing.actual_value = actual;
        updated += 1;
      } else {
        project.targets.push({
          id: newId(),
          measure_id: measureId,
          period,
          target_value: 0,
          actual_value: actual,
        });
        created += 1;
      }
    }

    await save(project);
    return { updated, created, project };
  },

  // ------------------------------------------------------- strategy edges

  addStrategyEdge: (pid, source, target, label = "") =>
    addTo(pid, "strategy_edges", { source, target, label }),

  deleteStrategyEdge: async (pid, eid) => {
    const project = await load(pid);
    project.strategy_edges = project.strategy_edges.filter((e) => e.id !== eid);
    await save(project);
    return { ok: true };
  },

  // ------------------------------------------------------------------ AI
  // The one call that leaves the browser. The scorecard snapshot is posted to a
  // serverless function so the model provider key stays server-side.
  aiSummary: async (pid) => {
    const project = await load(pid);
    return fetch("/api/ai-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project }),
    });
  },
};

export default api;
