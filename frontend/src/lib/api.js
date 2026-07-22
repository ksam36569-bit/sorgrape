import { supabase } from "./supabase";

// Data layer. Talks to Supabase directly — there is no application server any
// more. Every method below keeps the exact signature and return shape the old
// FastAPI client had, so the components consuming `api` did not change.

export const BASE = "";

// The four Balanced Scorecard perspectives are fixed by the framework, so they
// live in code rather than a table. The old API returned them on every project
// document and the sidebar still expects that.
export const PERSPECTIVES = [
  { id: "financial", name: "Financial" },
  { id: "customer", name: "Customer" },
  { id: "internal", name: "Internal Business Processes" },
  { id: "learning", name: "Learning & Growth" },
];

const CHILD_TABLES = [
  "departments",
  "objectives",
  "measures",
  "targets",
  "initiatives",
  "strategy_edges",
  "okrs",
  "key_results",
];

// OKRs and key results are user-reorderable, so they sort on `position` rather
// than created_at like everything else.
const ORDERED_BY_POSITION = new Set(["okrs", "key_results"]);

/** Unwrap a PostgREST result, turning its error into a throw. */
function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

/** Columns that exist on the row itself, minus anything the caller shouldn't set. */
function strip(payload, drop = ["id", "project_id", "created_at", "updated_at"]) {
  const out = { ...payload };
  for (const k of drop) delete out[k];
  return out;
}

const PROJECT_SELECT = `*, ${CHILD_TABLES.map((t) => `${t}(*)`).join(", ")}`;

/**
 * Reassemble the self-contained document the UI expects.
 *
 * PostgREST returns child rows nested but in arbitrary order, so they are sorted
 * by created_at to keep list rendering stable between reloads.
 */
function shapeProject(row) {
  if (!row) return null;
  const project = { ...row, perspectives: PERSPECTIVES };
  for (const t of CHILD_TABLES) {
    const rows = Array.isArray(row[t]) ? [...row[t]] : [];
    if (ORDERED_BY_POSITION.has(t)) rows.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    else rows.sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
    project[t] = rows;
  }
  return project;
}

async function fetchProject(id) {
  const row = unwrap(
    await supabase.from("projects").select(PROJECT_SELECT).eq("id", id).maybeSingle()
  );
  if (!row) throw new Error("Project not found");
  return shapeProject(row);
}

/** Case-insensitive name match, mirroring find_by_name() in the old backend. */
function findByName(items, name) {
  const target = String(name ?? "").trim().toLowerCase();
  return items.find((it) => String(it.name ?? "").trim().toLowerCase() === target) || null;
}

const num = (v) => Number(v ?? 0) || 0;

export const api = {
  // ------------------------------------------------------------- projects

  listProjects: async () => {
    // Counts come back as aggregates so the portal list doesn't pull every child row.
    const rows = unwrap(
      await supabase
        .from("projects")
        .select("*, objectives(count), measures(count)")
        .order("updated_at", { ascending: false })
    );
    return rows.map((d) => ({
      id: d.id,
      company_name: d.company_name,
      industry: d.industry ?? "",
      fiscal_year: d.fiscal_year ?? "",
      business_unit: d.business_unit ?? "",
      updated_at: d.updated_at,
      created_at: d.created_at,
      objectives_count: d.objectives?.[0]?.count ?? 0,
      measures_count: d.measures?.[0]?.count ?? 0,
    }));
  },

  createProject: async (payload) => {
    const { departments = [], ...fields } = payload || {};
    const project = unwrap(
      await supabase.from("projects").insert(strip(fields)).select().single()
    );
    if (departments.length) {
      unwrap(
        await supabase
          .from("departments")
          .insert(departments.map((name) => ({ project_id: project.id, name })))
      );
    }
    return fetchProject(project.id);
  },

  getProject: (id) => fetchProject(id),

  updateProject: async (id, payload) => {
    unwrap(await supabase.from("projects").update(strip(payload)).eq("id", id));
    return fetchProject(id);
  },

  deleteProject: async (id) => {
    unwrap(await supabase.from("projects").delete().eq("id", id));
    return { ok: true };
  },

  duplicateProject: async (id) => {
    const src = await fetchProject(id);
    return api.importProject({ ...src, company_name: `${src.company_name} (Copy)` });
  },

  /**
   * Insert a whole exported project.
   *
   * Rows arrive carrying their original ids, which cannot be reused. Each level
   * is inserted parent-first and the returned ids are remapped into the children,
   * so foreign keys and the initiative/strategy-edge references stay intact.
   */
  importProject: async (doc) => {
    const {
      id: _id,
      created_at: _c,
      updated_at: _u,
      perspectives: _p,
      departments = [],
      objectives = [],
      measures = [],
      targets = [],
      initiatives = [],
      strategy_edges = [],
      okrs = [],
      key_results: keyResults = [],
      ...fields
    } = doc || {};

    const project = unwrap(
      await supabase.from("projects").insert(strip(fields)).select().single()
    );
    const pid = project.id;

    const insertMapped = async (table, rows, remap = () => ({})) => {
      if (!rows.length) return new Map();
      const payload = rows.map((r) => ({
        ...strip(r, ["id", "project_id", "created_at", "updated_at"]),
        ...remap(r),
        project_id: pid,
      }));
      const inserted = unwrap(await supabase.from(table).insert(payload).select());
      // insert() preserves input order, so index alignment is safe here.
      return new Map(rows.map((r, i) => [r.id, inserted[i].id]));
    };

    const deptIds = await insertMapped("departments", departments);
    const objIds = await insertMapped("objectives", objectives, (o) => ({
      department_id: deptIds.get(o.department_id) ?? null,
    }));
    const measureIds = await insertMapped("measures", measures, (m) => ({
      objective_id: objIds.get(m.objective_id) ?? null,
    }));
    await insertMapped(
      "targets",
      targets.filter((t) => measureIds.has(t.measure_id)),
      (t) => ({ measure_id: measureIds.get(t.measure_id) })
    );
    await insertMapped("initiatives", initiatives, (i) => ({
      measure_ids: (i.measure_ids || []).map((m) => measureIds.get(m)).filter(Boolean),
    }));
    const okrIds = await insertMapped("okrs", okrs);
    await insertMapped(
      "key_results",
      keyResults.filter((k) => okrIds.has(k.okr_id)),
      (k) => ({ okr_id: okrIds.get(k.okr_id) })
    );
    await insertMapped(
      "strategy_edges",
      strategy_edges.filter((e) => objIds.has(e.source) && objIds.has(e.target)),
      (e) => ({ source: objIds.get(e.source), target: objIds.get(e.target) })
    );

    return fetchProject(pid);
  },

  // ---------------------------------------------------------- departments

  addDepartment: async (pid, name) =>
    unwrap(
      await supabase.from("departments").insert({ project_id: pid, name }).select().single()
    ),

  updateDepartment: async (pid, did, name) =>
    unwrap(
      await supabase
        .from("departments")
        .update({ name })
        .eq("id", did)
        .eq("project_id", pid)
        .select()
        .single()
    ),

  // Objectives are unassigned rather than deleted — the FK is ON DELETE SET NULL,
  // so the database handles what the old endpoint did in a follow-up loop.
  deleteDepartment: async (pid, did) => {
    unwrap(await supabase.from("departments").delete().eq("id", did).eq("project_id", pid));
    return { ok: true };
  },

  // ----------------------------------------------------------- objectives

  addObjective: async (pid, payload) =>
    unwrap(
      await supabase
        .from("objectives")
        .insert({ ...strip(payload), project_id: pid })
        .select()
        .single()
    ),

  updateObjective: async (pid, oid, payload) =>
    unwrap(
      await supabase
        .from("objectives")
        .update(strip(payload))
        .eq("id", oid)
        .eq("project_id", pid)
        .select()
        .single()
    ),

  // Dependent measures and their targets go with it via ON DELETE CASCADE.
  deleteObjective: async (pid, oid) => {
    unwrap(await supabase.from("objectives").delete().eq("id", oid).eq("project_id", pid));
    return { ok: true };
  },

  // ------------------------------------------------------------- measures

  addMeasure: async (pid, payload) =>
    unwrap(
      await supabase
        .from("measures")
        .insert({ ...strip(payload), project_id: pid })
        .select()
        .single()
    ),

  updateMeasure: async (pid, mid, payload) =>
    unwrap(
      await supabase
        .from("measures")
        .update(strip(payload))
        .eq("id", mid)
        .eq("project_id", pid)
        .select()
        .single()
    ),

  deleteMeasure: async (pid, mid) => {
    unwrap(await supabase.from("measures").delete().eq("id", mid).eq("project_id", pid));
    return { ok: true };
  },

  // -------------------------------------------------------------- targets

  addTarget: async (pid, payload) =>
    unwrap(
      await supabase
        .from("targets")
        .insert({ ...strip(payload), project_id: pid })
        .select()
        .single()
    ),

  updateTarget: async (pid, tid, payload) =>
    unwrap(
      await supabase
        .from("targets")
        .update(strip(payload))
        .eq("id", tid)
        .eq("project_id", pid)
        .select()
        .single()
    ),

  deleteTarget: async (pid, tid) => {
    unwrap(await supabase.from("targets").delete().eq("id", tid).eq("project_id", pid));
    return { ok: true };
  },

  // ---------------------------------------------------------- initiatives

  addInitiative: async (pid, payload) =>
    unwrap(
      await supabase
        .from("initiatives")
        .insert({ ...strip(payload), project_id: pid })
        .select()
        .single()
    ),

  updateInitiative: async (pid, iid, payload) =>
    unwrap(
      await supabase
        .from("initiatives")
        .update(strip(payload))
        .eq("id", iid)
        .eq("project_id", pid)
        .select()
        .single()
    ),

  deleteInitiative: async (pid, iid) => {
    unwrap(await supabase.from("initiatives").delete().eq("id", iid).eq("project_id", pid));
    return { ok: true };
  },

  // ---------------------------------------------------------- bulk import

  /**
   * Spreadsheet import. Ported from the Python bulk_import endpoint, including
   * its name-based matching and add / update / replace modes.
   *
   * Levels are processed parent-first because each one resolves parent names to
   * the ids produced by the level above.
   */
  bulkImport: async (pid, payload) => {
    const mode = payload?.mode || "add";
    const stats = { created: 0, updated: 0 };
    let doc = await fetchProject(pid);

    if (mode === "replace") {
      // Departments and objectives cascade down to measures and targets.
      for (const t of ["initiatives", "objectives", "departments"]) {
        unwrap(await supabase.from(t).delete().eq("project_id", pid));
      }
      doc = await fetchProject(pid);
    }

    // -- departments: created only, never updated (name is the only column)
    const newDepartments = [];
    for (const row of payload?.departments || []) {
      if (!row?.name) continue;
      if (findByName(doc.departments, row.name) || findByName(newDepartments, row.name)) continue;
      newDepartments.push({ project_id: pid, name: row.name });
    }
    if (newDepartments.length) {
      unwrap(await supabase.from("departments").insert(newDepartments));
      stats.created += newDepartments.length;
      doc = await fetchProject(pid);
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
        departmentId = findByName(doc.departments, row.department)?.id ?? null;
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
      const existing = findByName(doc.objectives, row.name);
      if (existing && mode !== "add") {
        unwrap(await supabase.from("objectives").update(values).eq("id", existing.id));
        stats.updated += 1;
      } else if (!existing) {
        unwrap(await supabase.from("objectives").insert({ ...values, project_id: pid }));
        stats.created += 1;
      }
    }
    doc = await fetchProject(pid);

    // -- measures
    for (const row of payload?.measures || []) {
      if (!row?.name) continue;
      let objectiveId = row.objective_id || null;
      if (!objectiveId && row.objective) {
        objectiveId = findByName(doc.objectives, row.objective)?.id ?? null;
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
      const existing = findByName(doc.measures, row.name);
      if (existing && mode !== "add") {
        unwrap(await supabase.from("measures").update(values).eq("id", existing.id));
        stats.updated += 1;
      } else if (!existing) {
        unwrap(await supabase.from("measures").insert({ ...values, project_id: pid }));
        stats.created += 1;
      }
    }
    doc = await fetchProject(pid);

    // -- targets, matched on (measure, period)
    for (const row of payload?.targets || []) {
      let measureId = row.measure_id || null;
      if (!measureId && row.measure) measureId = findByName(doc.measures, row.measure)?.id ?? null;
      if (!measureId) continue;
      const period = row.period ?? "";
      const values = {
        measure_id: measureId,
        period,
        target_value: num(row.target_value),
        actual_value: num(row.actual_value),
      };
      const existing = doc.targets.find((t) => t.measure_id === measureId && t.period === period);
      if (existing && mode !== "add") {
        unwrap(await supabase.from("targets").update(values).eq("id", existing.id));
        stats.updated += 1;
      } else if (!existing) {
        unwrap(await supabase.from("targets").insert({ ...values, project_id: pid }));
        stats.created += 1;
      }
    }
    doc = await fetchProject(pid);

    // -- initiatives
    for (const row of payload?.initiatives || []) {
      if (!row?.name) continue;
      let measureIds = row.measure_ids || [];
      if (!measureIds.length && row.measures) {
        measureIds = String(row.measures)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((nm) => findByName(doc.measures, nm)?.id)
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
      const existing = findByName(doc.initiatives, row.name);
      if (existing && mode !== "add") {
        unwrap(await supabase.from("initiatives").update(values).eq("id", existing.id));
        stats.updated += 1;
      } else if (!existing) {
        unwrap(await supabase.from("initiatives").insert({ ...values, project_id: pid }));
        stats.created += 1;
      }
    }

    return { stats, project: await fetchProject(pid) };
  },

  /** Quick "update actuals" upload: sets actual_value per (measure, period). */
  updateActuals: async (pid, rows) => {
    const doc = await fetchProject(pid);
    let updated = 0;
    let created = 0;

    for (const row of rows || []) {
      let measureId = row.measure_id || null;
      if (!measureId && row.measure) measureId = findByName(doc.measures, row.measure)?.id ?? null;
      if (!measureId) continue;
      const period = row.period ?? "";
      const actual = num(row.actual_value);
      const existing = doc.targets.find((t) => t.measure_id === measureId && t.period === period);
      if (existing) {
        unwrap(await supabase.from("targets").update({ actual_value: actual }).eq("id", existing.id));
        updated += 1;
      } else {
        unwrap(
          await supabase.from("targets").insert({
            project_id: pid,
            measure_id: measureId,
            period,
            target_value: 0,
            actual_value: actual,
          })
        );
        created += 1;
      }
    }

    return { updated, created, project: await fetchProject(pid) };
  },

  // ----------------------------------------------------------------- OKRs

  /** Append an OKR to the end of the list. */
  addOkr: async (pid, payload) => {
    const rows = unwrap(await supabase.from("okrs").select("position").eq("project_id", pid));
    const position = rows.reduce((max, r) => Math.max(max, r.position ?? 0), -1) + 1;
    return unwrap(
      await supabase.from("okrs").insert({ ...strip(payload), project_id: pid, position }).select().single()
    );
  },

  updateOkr: async (pid, oid, payload) =>
    unwrap(
      await supabase.from("okrs").update(strip(payload)).eq("id", oid).eq("project_id", pid).select().single()
    ),

  // Key results go with it via ON DELETE CASCADE.
  deleteOkr: async (pid, oid) => {
    unwrap(await supabase.from("okrs").delete().eq("id", oid).eq("project_id", pid));
    return { ok: true };
  },

  /** Persist a new order; callers pass ids in the order they should appear. */
  reorderOkrs: async (pid, orderedIds) => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      unwrap(await supabase.from("okrs").update({ position: i }).eq("id", orderedIds[i]).eq("project_id", pid));
    }
    return { ok: true };
  },

  addKeyResult: async (pid, okrId, payload) => {
    const rows = unwrap(await supabase.from("key_results").select("position").eq("okr_id", okrId));
    const position = rows.reduce((max, r) => Math.max(max, r.position ?? 0), -1) + 1;
    return unwrap(
      await supabase
        .from("key_results")
        .insert({ ...strip(payload), project_id: pid, okr_id: okrId, position })
        .select()
        .single()
    );
  },

  updateKeyResult: async (pid, krId, payload) =>
    unwrap(
      await supabase
        .from("key_results")
        .update(strip(payload, ["id", "project_id", "okr_id", "created_at"]))
        .eq("id", krId)
        .eq("project_id", pid)
        .select()
        .single()
    ),

  deleteKeyResult: async (pid, krId) => {
    unwrap(await supabase.from("key_results").delete().eq("id", krId).eq("project_id", pid));
    return { ok: true };
  },

  // ------------------------------------------------------- strategy edges

  addStrategyEdge: async (pid, source, target, label = "") =>
    unwrap(
      await supabase
        .from("strategy_edges")
        .insert({ project_id: pid, source, target, label })
        .select()
        .single()
    ),

  deleteStrategyEdge: async (pid, eid) => {
    unwrap(await supabase.from("strategy_edges").delete().eq("id", eid).eq("project_id", pid));
    return { ok: true };
  },

  // ------------------------------------------------------------------ AI
  // Stays server-side: the provider keys must not reach the browser.
  aiSummary: async (pid, signal) => {
    // The snapshot is posted rather than re-read server-side, so the function
    // needs no database credentials of its own.
    const project = await fetchProject(pid);
    return fetch("/api/ai-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project }),
      signal,
    });
  },
};

export default api;
