// In-memory stand-in for the Supabase client: enough PostgREST surface for the
// data layer, plus the FK cascades and the (measure_id, period) unique index
// that the real migration declares.
import { randomUUID } from "crypto";

export function makeFakeSupabase() {
  const db = {
    projects: [], departments: [], objectives: [], measures: [],
    targets: [], initiatives: [], strategy_edges: [],
  };

  const cascade = {
    projects:    (id) => { for (const t of ["departments","objectives","measures","targets","initiatives","strategy_edges"]) del(t, r => r.project_id === id); },
    departments: (id) => { for (const o of db.objectives) if (o.department_id === id) o.department_id = null; },  // ON DELETE SET NULL
    objectives:  (id) => { del("measures", r => r.objective_id === id); del("strategy_edges", r => r.source === id || r.target === id); },
    measures:    (id) => { del("targets", r => r.measure_id === id); },
  };
  function del(table, pred) {
    const gone = db[table].filter(pred);
    db[table] = db[table].filter(r => !pred(r));
    for (const r of gone) cascade[table]?.(r.id);
    return gone;
  }

  const defaults = {
    projects: { industry:"", fiscal_year:"", business_unit:"", vision:"", mission:"",
      strategic_themes:"", prepared_by:"", prepared_date:"",
      perspective_weights:{financial:25,customer:25,internal:25,learning:25},
      performance_thresholds:{red_max:70,amber_max:90} },
    objectives: { description:"", priority:"Medium", owner:"", timeline:"", status:"On Track",
      color:"#721B29", weight:0, perspective_id:"financial", department_id:null },
    measures: { description:"", unit:"%", weight:0, baseline:0, stretch_target:0,
      time_period:"Annual", owner:"", data_source:"", comments:"", objective_id:null },
    targets: { period:"", target_value:0, actual_value:0 },
    initiatives: { description:"", budget:0, owner:"", start_date:"", end_date:"", progress:0,
      status:"Planned", risk_level:"Low", expected_impact:"", dependencies:"", measure_ids:[] },
    strategy_edges: { label:"" },
    departments: {},
  };

  let seq = 0;
  const stamp = () => new Date(Date.UTC(2026, 0, 1, 0, 0, seq++)).toISOString();

  function from(table) {
    const q = { table, filters: [], _op: null, _rows: null, _single: null, _selected: false };

    q.select = function () { this._selected = true; return this; };
    q.eq = function (col, val) { this.filters.push([col, val]); return this; };
    q.order = function () { return this; };
    q.single = function () { this._single = "one"; return this; };
    q.maybeSingle = function () { this._single = "maybe"; return this; };

    q.insert = function (rows) {
      const list = Array.isArray(rows) ? rows : [rows];
      this._op = "insert";
      this._rows = list.map((r) => {
        // emulate the UNIQUE (measure_id, period) constraint
        if (table === "targets" && db.targets.some(t => t.measure_id === r.measure_id && t.period === (r.period ?? ""))) {
          throw new Error("duplicate key value violates unique constraint targets_measure_id_period_key");
        }
        const row = { ...defaults[table], ...r, id: randomUUID(), created_at: stamp() };
        if (table === "projects") row.updated_at = stamp();
        db[table].push(row);
        return row;
      });
      return this;
    };
    q.update = function (patch) { this._op = "update"; this._patch = patch; return this; };
    q.delete = function () { this._op = "delete"; return this; };

    q.then = function (resolve) {
      try {
        const match = (r) => this.filters.every(([c, v]) => r[c] === v);
        let data;
        if (this._op === "insert") data = this._rows;
        else if (this._op === "update") {
          data = db[this.table].filter(match);
          for (const r of data) Object.assign(r, this._patch);
        } else if (this._op === "delete") { del(this.table, match); data = []; }
        else data = db[this.table].filter(match);

        if (this._single) {
          if (!data.length) {
            if (this._single === "maybe") return resolve({ data: null, error: null });
            return resolve({ data: null, error: { message: "no rows" } });
          }
          return resolve({ data: data[0], error: null });
        }
        return resolve({ data, error: null });
      } catch (e) {
        return resolve({ data: null, error: { message: e.message } });
      }
    };
    return q;
  }

  // nested select (`*, departments(*), ...`) used by fetchProject / listProjects
  const realFrom = from;
  return {
    db,
    from(table) {
      const q = realFrom(table);
      const baseSelect = q.select.bind(q);
      q.select = function (cols = "*") { this._cols = cols; return baseSelect(); };
      const baseThen = q.then.bind(q);
      q.then = function (resolve) {
        return baseThen(({ data, error }) => {
          if (error || !this._cols || !this._cols.includes("(")) return resolve({ data, error });
          const expand = (row) => {
            const out = { ...row };
            for (const m of this._cols.matchAll(/(\w+)\((\*|count)\)/g)) {
              const [, child, kind] = m;
              const kids = db[child].filter((r) => r.project_id === row.id);
              out[child] = kind === "count" ? [{ count: kids.length }] : kids;
            }
            return out;
          };
          resolve({ data: Array.isArray(data) ? data.map(expand) : data ? expand(data) : data, error });
        });
      };
      return q;
    },
  };
}
