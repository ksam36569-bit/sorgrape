import { get, set, del, keys, createStore } from "idb-keyval";

// Persistence layer: IndexedDB in the user's browser. There is no server and no
// database account — a scorecard lives in the browser that created it.
//
// IndexedDB rather than localStorage because localStorage caps out around 5MB,
// stores strings only, and blocks the main thread on every write.
//
// The trade-off to be aware of: scorecards are per-browser and per-device, and
// clearing site data deletes them. The Reports view has JSON export/import for
// backing up and moving a scorecard between machines.

const store = createStore("sogrape-scorecard", "projects");

export const db = {
  get: (id) => get(id, store),
  put: (project) => set(project.id, project, store),
  remove: (id) => del(id, store),
  async all() {
    const ids = await keys(store);
    const rows = await Promise.all(ids.map((id) => get(id, store)));
    return rows.filter(Boolean);
  },
};

export const newId = () =>
  (crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`);

export const nowIso = () => new Date().toISOString();

export default db;
