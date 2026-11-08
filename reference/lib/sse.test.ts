import { describe, expect, it } from "vitest";
import { encodeSse, parseSse, upsertEvent } from "./sse";
import type { TraceEvent } from "@/lib/agent/types";

const thought = (id: string, text: string): TraceEvent => ({ kind: "thought", id, text });

describe("sse", () => {
  it("round-trips", () => {
    const { events, rest } = parseSse(encodeSse(thought("a", "hi")));
    expect(events).toEqual([thought("a", "hi")]);
    expect(rest).toBe("");
  });
  it("keeps a partial frame as the tail", () => {
    const full = encodeSse(thought("a", "x"));
    const { events, rest } = parseSse(full + full.slice(0, 10));
    expect(events).toHaveLength(1);
    expect(rest).toBe(full.slice(0, 10));
  });
  it("skips heartbeats and malformed frames", () => {
    const { events } = parseSse(`: beat\n\ndata: {oops\n\n${encodeSse(thought("b", "ok"))}`);
    expect(events).toEqual([thought("b", "ok")]);
  });
});

describe("upsertEvent", () => {
  it("appends new ids and replaces same ids in place", () => {
    let l: TraceEvent[] = [];
    l = upsertEvent(l, thought("1", "a"));
    l = upsertEvent(l, thought("2", "b"));
    l = upsertEvent(l, thought("1", "a2"));
    expect(l).toEqual([thought("1", "a2"), thought("2", "b")]);
  });
});
