import type { AgAiConversationItem, AgAiEvent, AgAiOutputItem, AgAiToolSchema, AgLlmAdapter, AgLlmRequest, AgLlmResponse } from "ag-studio";

/**
 * AG Studio LLM adapter for any OpenAI-compatible CHAT COMPLETIONS endpoint (OpenAI, the Astropods AI Gateway,
 * Anthropic's OpenAI-compatible endpoint, ...). It runs in the browser and talks to OUR proxy
 * (app/api/studio/llm/[...path]/route.ts), which holds the key. Studio runs the tools; this file only translates.
 *
 * The mapping functions are pure and unit-tested (chat-adapter.test.ts). It has NOT been run against a live Studio session.
 */

// ---------------- wire types (OpenAI chat completions) ----------------
export interface ChatToolCall { id: string; type: "function"; function: { name: string; arguments: string } }
export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ChatToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

// ---------------- request mapping (pure) ----------------
export function toChatMessages(req: Pick<AgLlmRequest, "input" | "instructions">): ChatMessage[] {
  const out: ChatMessage[] = [];
  if (req.instructions) out.push({ role: "system", content: req.instructions });

  // OpenAI wants an assistant's text AND its tool calls in ONE message, so we merge consecutive assistant items.
  let assistant: Extract<ChatMessage, { role: "assistant" }> | null = null;
  const flush = () => {
    if (assistant) out.push(assistant);
    assistant = null;
  };
  const ensure = () => (assistant ??= { role: "assistant", content: null });

  for (const item of req.input as AgAiConversationItem[]) {
    if (item.type === "message" && item.kind === "input") {
      flush();
      const text = item.content.map((c) => (c.type === "text" ? c.text : `[${c.type} omitted]`)).join("\n");
      out.push({ role: item.role, content: text });
    } else if (item.type === "message" && item.kind === "output") {
      const text = item.content.map((c) => (c.type === "text" ? c.text : c.refusal)).join("");
      if (text) {
        const a = ensure();
        a.content = (a.content ?? "") + text;
      }
    } else if (item.type === "function_call") {
      const a = ensure();
      (a.tool_calls ??= []).push({ id: item.callId, type: "function", function: { name: item.name, arguments: item.arguments || "{}" } });
    } else if (item.type === "function_call_output") {
      flush();
      out.push({ role: "tool", tool_call_id: item.callId, content: item.output });
    }
    // reasoning items are provider-private; not replayed
  }
  flush();
  return out;
}

export function toChatTools(tools: AgAiToolSchema[] | undefined) {
  return (tools ?? []).map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));
}

export function toToolChoice(c: AgLlmRequest["toolChoice"]) {
  if (c === undefined || c === "auto" || c === "none" || c === "required") return c;
  return { type: "function" as const, function: { name: c.name } };
}

// ---------------- response mapping (pure) ----------------
export function parseDataLines(buffer: string): { payloads: string[]; rest: string } {
  const frames = buffer.split("\n");
  const rest = frames.pop() ?? "";
  const payloads = frames.filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).filter((p) => p.length > 0);
  return { payloads, rest };
}

interface Chunk {
  choices?: { delta?: { content?: string | null; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

/** Turns streamed chat-completion chunks into AG-UI events, and at the end into Studio's output items. */
export class ChatStreamAccumulator {
  private text = "";
  private textId: string | null = null;
  private readonly calls = new Map<number, { id: string; name: string; args: string }>();
  usage: AgLlmResponse["usage"];

  constructor(private readonly messageId: string) {}

  push(chunk: Chunk): AgAiEvent[] {
    const events: AgAiEvent[] = [];
    if (chunk.usage) {
      this.usage = {
        inputTokens: chunk.usage.prompt_tokens ?? 0,
        outputTokens: chunk.usage.completion_tokens ?? 0,
        totalTokens: chunk.usage.total_tokens,
      };
    }
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) return events;

    if (delta.content) {
      if (!this.textId) {
        this.textId = this.messageId;
        events.push({ type: "TEXT_MESSAGE_START", messageId: this.textId, role: "assistant" });
      }
      this.text += delta.content;
      events.push({ type: "TEXT_MESSAGE_CONTENT", messageId: this.textId, delta: delta.content });
    }
    for (const tc of delta.tool_calls ?? []) {
      let call = this.calls.get(tc.index);
      if (!call) {
        call = { id: tc.id ?? `call_${tc.index}`, name: tc.function?.name ?? "", args: "" };
        this.calls.set(tc.index, call);
        events.push({ type: "TOOL_CALL_START", toolCallId: call.id, toolCallName: call.name, parentMessageId: this.messageId });
      }
      if (tc.function?.arguments) {
        call.args += tc.function.arguments;
        events.push({ type: "TOOL_CALL_ARGS", toolCallId: call.id, delta: tc.function.arguments });
      }
    }
    return events;
  }

  finish(): { events: AgAiEvent[]; output: AgAiOutputItem[] } {
    const events: AgAiEvent[] = [];
    const output: AgAiOutputItem[] = [];
    if (this.textId) {
      events.push({ type: "TEXT_MESSAGE_END", messageId: this.textId });
      output.push({ id: this.textId, kind: "output", type: "message", role: "assistant", status: "completed", content: [{ type: "text", text: this.text, annotations: [] }] });
    }
    for (const call of [...this.calls.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1])) {
      events.push({ type: "TOOL_CALL_END", toolCallId: call.id });
      output.push({ id: `fc_${call.id}`, kind: "output", type: "function_call", callId: call.id, name: call.name, arguments: call.args || "{}", status: "completed" });
    }
    return { events, output };
  }
}

// ---------------- the adapter ----------------
class AsyncQueue<T> {
  private items: T[] = [];
  private waiting: ((r: IteratorResult<T>) => void) | null = null;
  private closed = false;
  push(v: T) {
    if (this.waiting) {
      const w = this.waiting;
      this.waiting = null;
      w({ value: v, done: false });
    } else this.items.push(v);
  }
  close() {
    this.closed = true;
    if (this.waiting) this.waiting({ value: undefined as never, done: true });
  }
  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        if (this.items.length) return Promise.resolve({ value: this.items.shift() as T, done: false });
        if (this.closed) return Promise.resolve({ value: undefined as never, done: true });
        return new Promise((resolve) => (this.waiting = resolve));
      },
    };
  }
}

let seq = 0;
const nextId = (p: string) => `${p}-${Date.now().toString(36)}-${++seq}`;

export interface ChatAdapterOptions {
  /** Our proxy, e.g. "/api/studio/llm". The adapter appends "/chat/completions". */
  endpoint: string;
  /** Model id the provider understands. A Studio model picker selection overrides it. */
  model: string;
  fetchFn?: typeof fetch;
}

export function chatAdapter(opts: ChatAdapterOptions): AgLlmAdapter {
  const doFetch = opts.fetchFn ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  return {
    executeTurn(request, options) {
      const queue = new AsyncQueue<AgAiEvent>();
      const runId = nextId("run");
      const createdAt = Date.now();

      const complete = (async (): Promise<AgLlmResponse> => {
        const fail = (code: string, message: string, status: AgLlmResponse["status"] = "failed"): AgLlmResponse => {
          queue.push({ type: "RUN_ERROR", message, code });
          return { id: runId, createdAt, status, output: [], error: { code, message } };
        };
        try {
          queue.push({ type: "RUN_STARTED", threadId: runId, runId });
          const body: Record<string, unknown> = {
            model: request.model?.id ?? opts.model,
            messages: toChatMessages(request),
            stream: true,
            stream_options: { include_usage: true },
          };
          const tools = toChatTools(request.tools);
          if (tools.length) {
            body.tools = tools;
            const tc = toToolChoice(request.toolChoice);
            if (tc !== undefined) body.tool_choice = tc;
          }
          if (request.responseFormat.type === "json") {
            body.response_format = { type: "json_schema", json_schema: { name: request.responseFormat.name, schema: request.responseFormat.schema } };
          }

          const res = await doFetch(`${opts.endpoint.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
            signal: options?.signal,
          });
          if (!res.ok || !res.body) return fail(`http_${res.status}`, `LLM request failed (${res.status})`);

          const acc = new ChatStreamAccumulator(nextId("msg"));
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const { payloads, rest } = parseDataLines(buf);
            buf = rest;
            for (const p of payloads) {
              if (p === "[DONE]") continue;
              try {
                for (const e of acc.push(JSON.parse(p) as Chunk)) queue.push(e);
              } catch {
                /* a malformed chunk is skipped */
              }
            }
          }
          const { events, output } = acc.finish();
          for (const e of events) queue.push(e);
          queue.push({ type: "RUN_FINISHED", threadId: runId, runId });
          return { id: runId, createdAt, status: "completed", output, usage: acc.usage, model: String(body.model) };
        } catch (err) {
          const aborted = err instanceof DOMException && err.name === "AbortError";
          return fail(aborted ? "aborted" : "network", err instanceof Error ? err.message : "request failed", aborted ? "cancelled" : "failed");
        } finally {
          queue.close();
        }
      })();

      return { stream: queue, complete };
    },
  };
}
