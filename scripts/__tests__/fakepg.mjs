// Stand-in for pg: records every statement so the runner's behaviour can be asserted.
export const log = [];
export function reset() { log.length = 0; }
export let state = { applied: new Set(), failOn: null, connectFails: false };
export function configure(o) { state = { applied: new Set(), failOn: null, connectFails: false, ...o }; }

class Client {
  constructor(cfg) { this.cfg = cfg; log.push(["config", cfg.connectionString, JSON.stringify(cfg.ssl)]); }
  async connect() { if (state.connectFails) throw new Error("connection refused"); log.push(["connect"]); }
  async query(sql, params) {
    const head = String(sql).trim().split("\n")[0].slice(0, 46);
    log.push(["query", head, params ? JSON.stringify(params) : ""]);
    if (/create table if not exists public.schema_migrations/.test(sql)) return { rows: [] };
    if (/select filename from public.schema_migrations/.test(sql)) {
      return { rows: [...state.applied].map((f) => ({ filename: f })) };
    }
    if (state.failOn && sql.includes(state.failOn)) throw new Error("syntax error at or near ...");
    return { rows: [] };
  }
  async end() { log.push(["end"]); }
}
export default { Client };
