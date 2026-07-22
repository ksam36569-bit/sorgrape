import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useScorecard } from "../context/ScorecardContext";
import { BASE } from "@/lib/api";

const AiSummaryDialog = ({ open, onOpenChange }) => {
  const { project } = useScorecard();
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const controllerRef = useRef(null);

  const stop = () => {
    controllerRef.current?.abort();
    setRunning(false);
  };

  const run = async () => {
    if (!project) return;
    setText("");
    setError(null);
    setRunning(true);
    controllerRef.current = new AbortController();
    try {
      const res = await fetch(`${BASE}/api/projects/${project.id}/ai-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controllerRef.current.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const raw of parts) {
          const part = raw.replace(/^\n+/, "");
          if (!part.startsWith("data:")) continue;
          // Strip exactly one delimiter space, not all whitespace — trimming here
          // swallowed the spaces between streamed tokens and ran words together.
          let data = part.slice(5);
          if (data.startsWith(" ")) data = data.slice(1);

          const control = data.trim();
          if (control === "[DONE]") { setRunning(false); return; }
          if (control.startsWith("{")) {
            try {
              const maybe = JSON.parse(control);
              if (maybe && typeof maybe === "object" && maybe.error) {
                setError(maybe.error);
                setRunning(false);
                return;
              }
            } catch { /* not JSON, treat as text */ }
          }
          // Single pass so an escaped backslash isn't re-read as a newline escape.
          acc += data.replace(/\\(\\|n)/g, (_, c) => (c === "n" ? "\n" : "\\"));
          setText(acc);
        }
      }
    } catch (e) {
      if (e?.name !== "AbortError") setError(e.message || "Network error");
    } finally {
      setRunning(false);
    }
  };

  React.useEffect(() => {
    if (open && !text && !running) run();
    if (!open) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Summary copied to clipboard");
    } catch { toast.error("Could not copy"); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col" data-testid="ai-summary-dialog">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-sogrape-gold" />
            Analyze &amp; summarize
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Claude Sonnet 4.5 reads the current scorecard state and writes an executive briefing —
            wins, risks and recommended next actions.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {error && (
            <div className="rounded-md border border-rag-red/40 bg-rag-red/5 text-sm text-rag-red p-3 mb-3">
              {error}
            </div>
          )}
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-body text-sm leading-relaxed" data-testid="ai-summary-content">
            {text || (running ? <span className="text-muted-foreground italic">Thinking…</span> : <span className="text-muted-foreground italic">No summary yet.</span>)}
            {running && text && <span className="inline-block w-2 h-4 bg-sogrape-gold animate-pulse align-middle ml-1" />}
          </div>
        </div>

        <DialogFooter className="border-t border-border pt-3">
          <Button variant="ghost" onClick={copy} disabled={!text}><Copy className="h-4 w-4 mr-1.5" /> Copy</Button>
          <Button variant="outline" onClick={run} disabled={running} data-testid="ai-summary-regenerate">
            <RefreshCw className={`h-4 w-4 mr-1.5 ${running ? "animate-spin" : ""}`} /> {running ? "Streaming…" : "Regenerate"}
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AiSummaryDialog;
