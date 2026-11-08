// Run: node --test astropods/   (no dependencies). Uses fake gateway + fake app, no network.
import test from "node:test";
import assert from "node:assert/strict";
import { runAgent, runTool } from "./agent.mjs";

const ID = "123e4567-e89b-42d3-a456-426614174000";

function fakeFetch(script) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
    const next = script.shift();
    if (!next) throw new Error(`unexpected call ${url}`);
    return { ok: next.ok ?? true, status: next.status ?? 200, json: async () => next.json, text: async () => next.text ?? JSON.stringify(next.json) };
  };
  fn.calls = calls;
  return fn;
}
const cfg = { gatewayUrl: "https://gw", gatewayKey: "k", model: "claude-haiku-4-5", apiUrl: "https://app" };

test("tool loop: model asks for a replay, gets the app's answer, then explains", async () => {
  const f = fakeFetch([
    { json: { choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "replay_verdict", arguments: JSON.stringify({ promiseId: ID }) } }] } }] } },
    { json: { identical: true, stored: { reason: "CONDITION_MET" } } },
    { json: { choices: [{ message: { role: "assistant", content: "It was CONDITION_MET." } }] } },
  ]);
  const reply = await runAgent([{ role: "user", content: "why?" }], { ...cfg, fetchFn: f });
  assert.equal(reply, "It was CONDITION_MET.");
  assert.equal(f.calls[0].url, "https://gw/v1/chat/completions");
  assert.equal(f.calls[1].url, `https://app/api/verdict/replay?promiseId=${ID}`);
  const toolMsg = f.calls[2].body.messages.at(-1);
  assert.equal(toolMsg.role, "tool");
  assert.equal(toolMsg.tool_call_id, "c1");
});

test("a bad promise id never reaches the app", async () => {
  const f = fakeFetch([]);
  const out = await runTool("replay_verdict", JSON.stringify({ promiseId: "../../admin" }), { fetchFn: f, apiUrl: "https://app" });
  assert.match(out, /uuid/);
  assert.equal(f.calls.length, 0);
});

test("unknown tools are refused and limit is clamped", async () => {
  assert.match(await runTool("delete_everything", "{}", { fetchFn: fakeFetch([]), apiUrl: "https://app" }), /unknown tool/);
  const f = fakeFetch([{ json: [] }]);
  await runTool("list_recent_verdicts", JSON.stringify({ limit: 9999 }), { fetchFn: f, apiUrl: "https://app" });
  assert.equal(f.calls[0].url, "https://app/api/studio/query?limit=50");
});

test("gives up politely after maxSteps and surfaces gateway errors", async () => {
  const loop = () => ({ json: { choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "x", type: "function", function: { name: "list_recent_verdicts", arguments: "{}" } }] } }] } });
  const f = fakeFetch([loop(), { json: [] }, loop(), { json: [] }]);
  assert.match(await runAgent([{ role: "user", content: "hi" }], { ...cfg, fetchFn: f, maxSteps: 2 }), /could not finish/);
  await assert.rejects(runAgent([{ role: "user", content: "hi" }], { ...cfg, fetchFn: fakeFetch([{ ok: false, status: 500, json: {} }]) }), /gateway 500/);
});
