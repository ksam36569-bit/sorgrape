// Vercel serverless function: streaming executive briefing over SSE.
//
// This is the only server-side code left. It exists so the provider API keys
// never reach the browser — everything else the app does goes straight to
// Supabase from the client.
//
// The scorecard itself is stored in the user's browser, so the client posts the
// snapshot in the request body — this function keeps no data of its own.
//
// Deliberately dependency-free: Node 18+ has global fetch and both providers are
// plain REST, so the cold start stays short and no root package.json is needed.

const PERSPECTIVES = [
  { id: "financial", name: "Financial" },
  { id: "customer", name: "Customer" },
  { id: "internal", name: "Internal Business Processes" },
  { id: "learning", name: "Learning & Growth" },
];

const AI_SYSTEM =
  "You are a seasoned Balanced Scorecard consultant advising Sogrape's executive team. " +
  "You'll receive a snapshot of Sogrape's scorecard: perspectives, objectives, measures with " +
  "achievement percentages, and initiatives. Produce a crisp executive-briefing narrative in " +
  "markdown, structured as: \n\n" +
  "## Executive summary\n(2-3 sentences on overall health)\n\n" +
  "## Wins (up to 3)\n- ...\n\n" +
  "## Areas at risk (up to 3)\n- ...\n\n" +
  "## Recommended next actions (up to 5)\n1. ...\n\n" +
  "Ground every claim in the numbers provided. Do not invent measures. Keep it concise, executive-tone, " +
  "and highlight quick wins vs. structural risks.";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

// ---------------------------------------------------------------- prompt

/**
 * Build the snapshot. Scores are computed here rather than sent as raw rows so
 * the model reasons over numbers instead of doing arithmetic. Ported verbatim
 * from _build_summary_prompt in the old Python backend.
 */
function buildSummaryPrompt(project) {
  const objs = project.objectives || [];
  const meas = project.measures || [];
  const tgts = project.targets || [];
  const weights = project.perspective_weights || {};

  const measurePct = (m) => {
    const rel = tgts.filter((t) => t.measure_id === m.id);
    if (!rel.length) return 0;
    const sum = rel.reduce(
      (acc, t) => acc + (Number(t.actual_value || 0) / (Number(t.target_value || 0) || 1)) * 100,
      0
    );
    return sum / rel.length;
  };
  const objectiveScore = (o) => {
    const oms = meas.filter((m) => m.objective_id === o.id);
    if (!oms.length) return 0;
    return oms.reduce((acc, m) => acc + measurePct(m) * (Number(m.weight || 0) / 100), 0);
  };
  const perspectiveScore = (pid) => {
    const oss = objs.filter((o) => o.perspective_id === pid);
    if (!oss.length) return 0;
    return oss.reduce((acc, o) => acc + objectiveScore(o) * (Number(o.weight || 0) / 100), 0);
  };

  const lines = [
    `Company: ${project.company_name}`,
    `Industry: ${project.industry}`,
    `Fiscal Year: ${project.fiscal_year}`,
    `Vision: ${project.vision || "n/a"}`,
    `Mission: ${project.mission || "n/a"}`,
    "",
    "Perspective scores (weight):",
  ];
  for (const p of PERSPECTIVES) {
    lines.push(`- ${p.name}: ${perspectiveScore(p.id).toFixed(1)}%  (weight ${weights[p.id] ?? 0}%)`);
  }

  const pname = (id) => PERSPECTIVES.find((p) => p.id === id)?.name || "?";
  lines.push("", "Objectives:");
  for (const o of objs) {
    lines.push(
      `- [${pname(o.perspective_id)}] ${o.name}  score=${objectiveScore(o).toFixed(1)}%  ` +
        `weight=${o.weight ?? 0}%  status=${o.status}  priority=${o.priority}  owner=${o.owner || "—"}`
    );
  }

  lines.push("", "Top measures (up to 20):");
  for (const m of meas.slice(0, 20)) {
    const obj = objs.find((o) => o.id === m.objective_id);
    lines.push(
      `- ${m.name} · unit=${m.unit} · weight=${m.weight ?? 0}% · ` +
        `achievement=${measurePct(m).toFixed(1)}% · objective=${obj ? obj.name : "—"}`
    );
  }

  lines.push("", "Initiatives:");
  for (const i of project.initiatives || []) {
    lines.push(
      `- ${i.name}  progress=${i.progress ?? 0}%  status=${i.status}  ` +
        `risk=${i.risk_level}  owner=${i.owner || "—"}`
    );
  }

  return lines.join("\n");
}

// ------------------------------------------------------------ providers

/** Yield text deltas from an SSE body, passing each `data:` payload to `pick`. */
async function* readSse(body, pick) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;
        let json;
        try {
          json = JSON.parse(raw);
        } catch {
          continue;
        }
        const text = pick(json);
        if (text) yield text;
      }
    }
  }
}

async function* streamOpenAI(prompt) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      stream: true,
      messages: [
        { role: "system", content: AI_SYSTEM },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  yield* readSse(res.body, (j) => j.choices?.[0]?.delta?.content);
}

async function* streamAnthropic(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      stream: true,
      system: AI_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  yield* readSse(res.body, (j) =>
    j.type === "content_block_delta" ? j.delta?.text : undefined
  );
}

// ------------------------------------------------------------- handler

const sseText = (chunk) =>
  `data: ${chunk.replace(/\\/g, "\\\\").replace(/\n/g, "\\n")}\n\n`;
const sseError = (msg) => `data: ${JSON.stringify({ error: String(msg) })}\n\n`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const project = req.body?.project;
  if (!project || typeof project !== "object") {
    res.write(sseError("A project snapshot is required in the request body."));
    res.end();
    return;
  }

  const providers = [];
  if (process.env.OPENAI_API_KEY) providers.push(["OpenAI", streamOpenAI]);
  if (process.env.ANTHROPIC_API_KEY) providers.push(["Anthropic", streamAnthropic]);
  if (!providers.length) {
    res.write(sseError("No AI provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY."));
    res.end();
    return;
  }

  const prompt =
    `Here is the scorecard snapshot:\n\n${buildSummaryPrompt(project)}\n\nWrite the briefing now.`;

  let lastError = null;
  for (const [name, streamFn] of providers) {
    let emitted = false;
    try {
      for await (const chunk of streamFn(prompt)) {
        emitted = true;
        res.write(sseText(chunk));
      }
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    } catch (err) {
      console.warn(`AI summary via ${name} failed:`, err.message);
      lastError = err;
      if (emitted) {
        // Retrying mid-stream would duplicate text the user can already see.
        res.write(sseError(`${name} stream interrupted: ${err.message}`));
        res.end();
        return;
      }
      // Nothing sent yet, so falling through to the next provider is safe.
    }
  }

  res.write(sseError(`All AI providers failed. Last error: ${lastError?.message}`));
  res.end();
}
