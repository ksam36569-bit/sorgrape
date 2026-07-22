import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";

const ScorecardCtx = createContext(null);
const LS_KEY = "sogrape.currentProjectId";

export const ScorecardProvider = ({ children }) => {
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentProjectId, setCurrentProjectId] = useState(() => localStorage.getItem(LS_KEY));

  const refreshProjects = useCallback(async () => {
    try {
      const list = await api.listProjects();
      setProjects(list);
      return list;
    } catch (e) {
      toast.error("Could not load projects");
      return [];
    }
  }, []);

  const loadProject = useCallback(async (id) => {
    if (!id) {
      setProject(null);
      localStorage.removeItem(LS_KEY);
      return null;
    }
    try {
      const p = await api.getProject(id);
      setProject(p);
      localStorage.setItem(LS_KEY, id);
      setCurrentProjectId(id);
      return p;
    } catch (e) {
      toast.error("Project not found");
      localStorage.removeItem(LS_KEY);
      setCurrentProjectId(null);
      return null;
    }
  }, []);

  const refreshProject = useCallback(async () => {
    if (currentProjectId) await loadProject(currentProjectId);
  }, [currentProjectId, loadProject]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refreshProjects();
      if (currentProjectId) await loadProject(currentProjectId);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createProject = useCallback(async (payload) => {
    const p = await api.createProject(payload);
    await refreshProjects();
    await loadProject(p.id);
    return p;
  }, [refreshProjects, loadProject]);

  const value = useMemo(() => ({
    projects,
    project,
    loading,
    currentProjectId,
    setCurrentProjectId,
    refreshProjects,
    refreshProject,
    loadProject,
    createProject,
    setProject, // for optimistic updates
  }), [projects, project, loading, currentProjectId, refreshProjects, refreshProject, loadProject, createProject]);

  return <ScorecardCtx.Provider value={value}>{children}</ScorecardCtx.Provider>;
};

export const useScorecard = () => {
  const ctx = useContext(ScorecardCtx);
  if (!ctx) throw new Error("useScorecard must be used within ScorecardProvider");
  return ctx;
};
