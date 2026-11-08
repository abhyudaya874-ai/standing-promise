import { describe, expect, it } from "vitest";
import { ChatStreamAccumulator, chatAdapter, parseDataLines, toChatMessages, toChatTools, toToolChoice } from "./chat-adapter";

const userMsg = (text: string) => ({ id: "u", kind: "input" as const, type: "message" as const, role: "user" as const, status: "completed" as const, content: [{ type: "text" as const, text }] });
const asstMsg = (text: string) => ({ id: "a", kind: "output" as const, type: "message" as const, role: "assistant" as const, status: "completed" as const, content: [{ type: "text" as const, text, annotations: [] }] });
const call = (id: string, name: string, args: string) => ({ id: `fc_${id}`, kind: "output" as const, type: "function_call" as const, callId: id, name, arguments: args });
const result = (id: string, output: string) => ({ type: "function_call_output" as const, callId: id, output, status: "completed" as const });

describe("toChatMessages", () => {
  it("puts instructions first as a system message", () => {
    expect(toChatMessages({ instructions: "be nice", input: [userMsg("hi")] })).toEqual([{ role: "system", content: "be nice" }, { role: "user", content: "hi" }]);
  });
  it("merges assistant text and tool calls into ONE assistant message, then a tool message", () => {
    const m = toChatMessages({ input: [userMsg("go"), asstMsg("checking"), call("c1", "replay_verdict", '{"promiseId":"x"}'), result("c1", '{"identical":true}')] });
    expect(m).toEqual([
      { role: "user", content: "go" },
      { role: "assistant", content: "checking", tool_calls: [{ id: "c1", type: "function", function: { name: "replay_verdict", arguments: '{"promiseId":"x"}' } }] },
      { role: "tool", tool_call_id: "c1", content: '{"identical":true}' },
    ]);
  });
  it("a tool-only assistant turn has null content and several calls stay together", () => {
    const m = toChatMessages({ input: [call("a", "t1", ""), call("b", "t2", "{}")] });
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ role: "assistant", content: null });
    expect((m[0] as { tool_calls: unknown[] }).tool_calls).toHaveLength(2);
    expect((m[0] as { tool_calls: { function: { arguments: string } }[] }).tool_calls[0].function.arguments).toBe("{}");
  });
});

describe("tools mapping", () => {
  it("wraps tools as functions", () => {
    expect(toChatTools([{ name: "n", description: "d", parameters: { type: "object" } } as never])[0]).toEqual({ type: "function", function: { name: "n", description: "d", parameters: { type: "object" } } });
    expect(toChatTools(undefined)).toEqual([]);
  });
  it("maps tool choice", () => {
    expect(toToolChoice("auto")).toBe("auto");
    expect(toToolChoice({ name: "x" })).toEqual({ type: "function", function: { name: "x" } });
    expect(toToolChoice(undefined)).toBeUndefined();
  });
});

describe("parseDataLines", () => {
  it("returns complete data lines and keeps the tail", () => {
    expect(parseDataLines('data: {"a":1}\n\ndata: [DONE]\ndata: {"b"')).toEqual({ payloads: ['{"a":1}', "[DONE]"], rest: 'data: {"b"' });
  });
});

describe("ChatStreamAccumulator", () => {
  it("streams text and reports one completed message", () => {
    const acc = new ChatStreamAccumulator("m1");
    const e1 = acc.push({ choices: [{ delta: { content: "Hel" } }] });
    const e2 = acc.push({ choices: [{ delta: { content: "lo" } }] });
    expect(e1.map((e) => e.type)).toEqual(["TEXT_MESSAGE_START", "TEXT_MESSAGE_CONTENT"]);
    expect(e2.map((e) => e.type)).toEqual(["TEXT_MESSAGE_CONTENT"]);
    const { output, events } = acc.finish();
    expect(events.map((e) => e.type)).toEqual(["TEXT_MESSAGE_END"]);
    expect(output[0]).toMatchObject({ type: "message", content: [{ type: "text", text: "Hello" }] });
  });
  it("assembles a tool call from argument fragments", () => {
    const acc = new ChatStreamAccumulator("m1");
    acc.push({ choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "replay_verdict", arguments: '{"promi' } }] } }] });
    acc.push({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'seId":"x"}' } }] } }] });
    const { output } = acc.finish();
    expect(output).toEqual([{ id: "fc_c1", kind: "output", type: "function_call", callId: "c1", name: "replay_verdict", arguments: '{"promiseId":"x"}', status: "completed" }]);
  });
  it("captures usage", () => {
    const acc = new ChatStreamAccumulator("m1");
    acc.push({ usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 } });
    expect(acc.usage).toEqual({ inputTokens: 5, outputTokens: 7, totalTokens: 12 });
  });
});

describe("chatAdapter.executeTurn with a fake fetch", () => {
  const sse = (...chunks: unknown[]) => new Response(chunks.map((c) => `data: ${typeof c === "string" ? c : JSON.stringify(c)}\n\n`).join(""), { status: 200 });

  it("posts to <endpoint>/chat/completions and completes with the assistant text", async () => {
    let url = "";
    let sent: Record<string, unknown> = {};
    const adapter = chatAdapter({
      endpoint: "/api/studio/llm/",
      model: "m",
      fetchFn: (async (u: string, init: RequestInit) => {
        url = u;
        sent = JSON.parse(String(init.body));
        return sse({ choices: [{ delta: { content: "Hi" } }] }, "[DONE]");
      }) as never,
    });
    const h = adapter.executeTurn({ input: [userMsg("hello")], instructions: "sys", responseFormat: { type: "text" } });
    const seen: string[] = [];
    for await (const e of h.stream) seen.push(e.type);
    const done = await h.complete;
    expect(url).toBe("/api/studio/llm/chat/completions");
    expect(sent.model).toBe("m");
    expect(sent.stream).toBe(true);
    expect(done.status).toBe("completed");
    expect(seen[0]).toBe("RUN_STARTED");
    expect(seen.at(-1)).toBe("RUN_FINISHED");
    expect(done.output[0]).toMatchObject({ type: "message" });
  });

  it("reports a failed run (no throw) on a non-2xx response", async () => {
    const adapter = chatAdapter({ endpoint: "/x", model: "m", fetchFn: (async () => new Response("no", { status: 503 })) as never });
    const h = adapter.executeTurn({ input: [userMsg("hi")], responseFormat: { type: "text" } });
    const types: string[] = [];
    for await (const e of h.stream) types.push(e.type);
    const done = await h.complete;
    expect(done.status).toBe("failed");
    expect(done.error?.code).toBe("http_503");
    expect(types).toContain("RUN_ERROR");
  });
});
