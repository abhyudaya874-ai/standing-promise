// The concierge's brain. Zero dependencies. Pure of the HTTP server so it can be tested with fakes.
// Talks to the Astropods AI Gateway over the OpenAI-compatible chat-completions API with tool calling,
// and uses two READ-ONLY tools against the Standing Promise app. It can never decide, capture, or change anything.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SYSTEM_PROMPT =
  "You are the Promise concierge for Standing Promise. Verdicts are COMPUTED by code and stored; you never decide, guess or promise an outcome. " +
  "To explain an outcome, call replay_verdict and quote the reason code and the diag numbers. All money values are in minor units (1050 = 10.50). " +
  "Use list_recent_verdicts to find a promise. Be friendly and brief, never a collections voice.";

export const TOOLS = [
  {
    type: "function",
    function: {
      name: "list_recent_verdicts",
      description: "List the most recent verdicts: promise id, payer, amount, reason code, kind.",
      parameters: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 50 } } },
    },
  },
  {
    type: "function",
    function: {
      name: "replay_verdict",
      description: "Recompute one promise's stored verdict from its stored input and report whether it is identical.",
      parameters: { type: "object", properties: { promiseId: { type: "string", description: "uuid" } }, required: ["promiseId"] },
    },
  },
];

/** Executes ONE tool call against the app. Fixed paths only: the model cannot choose a URL. */
export async function runTool(name, rawArgs, { fetchFn, apiUrl }) {
  let args;
  try {
    args = JSON.parse(rawArgs || "{}");
  } catch {
    return JSON.stringify({ error: "arguments were not valid JSON" });
  }
  let path;
  if (name === "list_recent_verdicts") {
    const n = Number.isInteger(args.limit) ? Math.min(Math.max(args.limit, 1), 50) : 10;
    path = `/api/studio/query?limit=${n}`;
  } else if (name === "replay_verdict") {
    if (typeof args.promiseId !== "string" || !UUID.test(args.promiseId)) return JSON.stringify({ error: "promiseId must be a uuid" });
    path = `/api/verdict/replay?promiseId=${args.promiseId}`;
  } else {
    return JSON.stringify({ error: `unknown tool ${name}` });
  }
  try {
    const res = await fetchFn(`${apiUrl}${path}`, { signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    return text.length > 6000 ? text.slice(0, 6000) + "…(truncated)" : text;
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : "request failed" });
  }
}

/** One conversation turn. Loops model -> tools -> model, at most `maxSteps` model calls. Returns the final text. */
export async function runAgent(messages, { fetchFn = fetch, gatewayUrl, gatewayKey, model, apiUrl, maxSteps = 5 }) {
  const convo = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];
  for (let step = 0; step < maxSteps; step++) {
    const res = await fetchFn(`${gatewayUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${gatewayKey}` },
      body: JSON.stringify({ model, messages: convo, tools: TOOLS, tool_choice: "auto" }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`gateway ${res.status}`);
    const msg = (await res.json()).choices?.[0]?.message;
    if (!msg) throw new Error("gateway returned no message");
    convo.push(msg);
    if (!msg.tool_calls?.length) return msg.content ?? "";
    for (const call of msg.tool_calls) {
      const content = await runTool(call.function.name, call.function.arguments, { fetchFn, apiUrl });
      convo.push({ role: "tool", tool_call_id: call.id, content });
    }
  }
  return "I could not finish that in a few steps. Try asking about one promise id.";
}
