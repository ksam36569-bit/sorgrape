import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;
const API = `${BASE}/api`;

const client = axios.create({ baseURL: API, headers: { "Content-Type": "application/json" } });

export const api = {
  listProjects: () => client.get("/projects").then((r) => r.data),
  createProject: (payload) => client.post("/projects", payload).then((r) => r.data),
  getProject: (id) => client.get(`/projects/${id}`).then((r) => r.data),
  updateProject: (id, payload) => client.put(`/projects/${id}`, payload).then((r) => r.data),
  deleteProject: (id) => client.delete(`/projects/${id}`).then((r) => r.data),
  duplicateProject: (id) => client.post(`/projects/${id}/duplicate`).then((r) => r.data),
  importProject: (payload) => client.post(`/projects/import`, payload).then((r) => r.data),

  addDepartment: (pid, name) => client.post(`/projects/${pid}/departments`, { name }).then((r) => r.data),
  updateDepartment: (pid, did, name) => client.put(`/projects/${pid}/departments/${did}`, { name }).then((r) => r.data),
  deleteDepartment: (pid, did) => client.delete(`/projects/${pid}/departments/${did}`).then((r) => r.data),

  addObjective: (pid, payload) => client.post(`/projects/${pid}/objectives`, payload).then((r) => r.data),
  updateObjective: (pid, oid, payload) => client.put(`/projects/${pid}/objectives/${oid}`, payload).then((r) => r.data),
  deleteObjective: (pid, oid) => client.delete(`/projects/${pid}/objectives/${oid}`).then((r) => r.data),

  addMeasure: (pid, payload) => client.post(`/projects/${pid}/measures`, payload).then((r) => r.data),
  updateMeasure: (pid, mid, payload) => client.put(`/projects/${pid}/measures/${mid}`, payload).then((r) => r.data),
  deleteMeasure: (pid, mid) => client.delete(`/projects/${pid}/measures/${mid}`).then((r) => r.data),

  addTarget: (pid, payload) => client.post(`/projects/${pid}/targets`, payload).then((r) => r.data),
  updateTarget: (pid, tid, payload) => client.put(`/projects/${pid}/targets/${tid}`, payload).then((r) => r.data),
  deleteTarget: (pid, tid) => client.delete(`/projects/${pid}/targets/${tid}`).then((r) => r.data),

  addInitiative: (pid, payload) => client.post(`/projects/${pid}/initiatives`, payload).then((r) => r.data),
  updateInitiative: (pid, iid, payload) => client.put(`/projects/${pid}/initiatives/${iid}`, payload).then((r) => r.data),
  deleteInitiative: (pid, iid) => client.delete(`/projects/${pid}/initiatives/${iid}`).then((r) => r.data),

  bulkImport: (pid, payload) => client.post(`/projects/${pid}/bulk-import`, payload).then((r) => r.data),
  updateActuals: (pid, rows) => client.post(`/projects/${pid}/update-actuals`, { rows }).then((r) => r.data),

  addStrategyEdge: (pid, source, target, label = "") => client.post(`/projects/${pid}/strategy-edges`, { source, target, label }).then((r) => r.data),
  deleteStrategyEdge: (pid, eid) => client.delete(`/projects/${pid}/strategy-edges/${eid}`).then((r) => r.data),

  // SSE — returns fetch response for streaming; consumer handles parsing.
  aiSummary: (pid) => fetch(`${API}/projects/${pid}/ai-summary`, { method: "POST", headers: { "Content-Type": "application/json" } }),
};

export default api;
