import React, { useMemo, useCallback, useState } from "react";
import ReactFlow, {
  Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, MarkerType, Handle, Position,
} from "reactflow";
import "reactflow/dist/style.css";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useScorecard } from "../context/ScorecardContext";
import { PERSPECTIVES, PERSPECTIVE_MAP } from "../lib/constants";
import { api } from "../lib/api";
import { toast } from "sonner";
import { objectiveScore, rating, fmtPct } from "../lib/calculations";
import { useTheme } from "../context/ThemeProvider";
import { Info, Wand2 } from "lucide-react";

const PERSPECTIVE_ROW = { learning: 3, internal: 2, customer: 1, financial: 0 };
const ROW_H = 170;
const COL_W = 260;

const RatingColor = { red: "#D93838", amber: "#D98A29", green: "#35824C" };

// Custom node
const ObjectiveNode = ({ data }) => {
  const bg = data.theme === "dark" ? "#24191A" : "#FFFFFF";
  const border = RatingColor[data.rag] || "#C6A87C";
  return (
    <div
      className="rounded-xl border-2 shadow-sm text-left relative"
      style={{ background: bg, borderColor: border, width: 220, padding: "10px 12px" }}
    >
      <Handle type="target" position={Position.Bottom} style={{ background: border, width: 8, height: 8 }} />
      <div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">{data.perspective}</div>
      <div className="font-serif text-sm leading-tight mt-1 line-clamp-2">{data.label}</div>
      <div className="mt-2 flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">{data.owner || "—"}</span>
        <span className="tabular-nums font-medium" style={{ color: border }}>{data.scoreLabel}</span>
      </div>
      <Handle type="source" position={Position.Top} style={{ background: border, width: 8, height: 8 }} />
      <Handle id="left" type="source" position={Position.Left} style={{ background: border, width: 6, height: 6 }} />
      <Handle id="right" type="target" position={Position.Right} style={{ background: border, width: 6, height: 6 }} />
    </div>
  );
};

const nodeTypes = { objective: ObjectiveNode };

const StrategyMapView = () => {
  const { project, refreshProject } = useScorecard();
  const { theme } = useTheme();

  // Layout: rows by perspective, cols by insertion order
  const initialNodes = useMemo(() => {
    const buckets = { financial: [], customer: [], internal: [], learning: [] };
    for (const o of project.objectives) if (buckets[o.perspective_id]) buckets[o.perspective_id].push(o);

    const nodes = [];
    for (const [pid, list] of Object.entries(buckets)) {
      list.forEach((o, i) => {
        const score = objectiveScore(o, project.measures, project.targets);
        const rag = rating(score, project.performance_thresholds);
        nodes.push({
          id: o.id,
          type: "objective",
          position: { x: 40 + i * COL_W, y: 40 + PERSPECTIVE_ROW[pid] * ROW_H },
          data: {
            label: o.name,
            perspective: PERSPECTIVE_MAP[pid]?.short || "",
            owner: o.owner,
            scoreLabel: fmtPct(score, 0),
            rag,
            theme,
          },
        });
      });
    }
    return nodes;
  }, [project, theme]);

  const initialEdges = useMemo(
    () =>
      (project.strategy_edges || []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label || undefined,
        animated: true,
        style: { stroke: theme === "dark" ? "#D8BC94" : "#9F5E46", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: theme === "dark" ? "#D8BC94" : "#9F5E46" },
      })),
    [project.strategy_edges, theme]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  React.useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);

  const onConnect = useCallback(
    async (params) => {
      // Persist edge to backend, then reflect locally
      try {
        const edge = await api.addStrategyEdge(project.id, params.source, params.target);
        setEdges((eds) =>
          addEdge(
            {
              ...params,
              id: edge.id,
              animated: true,
              style: { stroke: theme === "dark" ? "#D8BC94" : "#9F5E46", strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: theme === "dark" ? "#D8BC94" : "#9F5E46" },
            },
            eds
          )
        );
        await refreshProject();
        toast.success("Connection added");
      } catch (e) {
        toast.error(e?.response?.data?.detail || "Could not add connection");
      }
    },
    [project.id, refreshProject, setEdges, theme]
  );

  const onEdgeClick = useCallback(
    async (_e, edge) => {
      if (!window.confirm("Remove this connection?")) return;
      try {
        await api.deleteStrategyEdge(project.id, edge.id);
        setEdges((eds) => eds.filter((x) => x.id !== edge.id));
        await refreshProject();
      } catch {
        toast.error("Could not delete");
      }
    },
    [project.id, refreshProject, setEdges]
  );

  const suggestStandardChain = async () => {
    // For each objective, connect it to the first objective in the perspective above (L&G → Internal → Customer → Financial)
    const buckets = { financial: [], customer: [], internal: [], learning: [] };
    for (const o of project.objectives) if (buckets[o.perspective_id]) buckets[o.perspective_id].push(o);
    const order = ["learning", "internal", "customer", "financial"];
    const existing = new Set((project.strategy_edges || []).map((e) => `${e.source}::${e.target}`));
    let added = 0;
    for (let i = 0; i < order.length - 1; i++) {
      const from = buckets[order[i]];
      const to = buckets[order[i + 1]];
      for (const s of from) {
        for (const t of to) {
          const k = `${s.id}::${t.id}`;
          if (existing.has(k)) continue;
          try {
            await api.addStrategyEdge(project.id, s.id, t.id);
            existing.add(k);
            added++;
          } catch {}
        }
      }
    }
    await refreshProject();
    toast.success(`Added ${added} standard connections`);
  };

  const bgColor = theme === "dark" ? "#1A1213" : "#FAFAF8";

  return (
    <div className="space-y-3" data-testid="strategy-map">
      <Card className="p-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-start gap-2 text-sm text-muted-foreground max-w-2xl">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Drag from one objective handle to another to create cause-and-effect links. Rows are laid out
            in the classic Kaplan-Norton order: <b>Learning &amp; Growth → Internal → Customer → Financial</b>.
            Click any arrow to remove it.
          </p>
        </div>
        <Button variant="outline" onClick={suggestStandardChain} data-testid="strategy-map-standard-chain">
          <Wand2 className="h-4 w-4 mr-1.5" /> Suggest standard chain
        </Button>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div style={{ height: 640, background: bgColor }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeClick={onEdgeClick}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} color={theme === "dark" ? "#362729" : "#E5DFDA"} />
            <Controls />
            <MiniMap
              nodeColor={(n) => RatingColor[n.data?.rag] || "#C6A87C"}
              maskColor={theme === "dark" ? "rgba(26,18,19,0.7)" : "rgba(250,250,248,0.7)"}
              pannable
              zoomable
            />
          </ReactFlow>
        </div>
      </Card>

      {/* Legend rows */}
      <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
        {PERSPECTIVES.slice().reverse().map((p) => (
          <div key={p.id} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary/40" /> {p.short}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StrategyMapView;
