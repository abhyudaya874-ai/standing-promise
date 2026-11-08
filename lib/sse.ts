import type { TraceEvent } from "@/lib/agent/types";

/** One SSE frame. Server side. */
export function encodeSse(e: TraceEvent): string {
  return `data: ${JSON.stringify(e)}\n\n`;
}

/**
 * Client side: feed it the growing buffer, get complete events + the unfinished tail.
 * Heartbeat frames (": beat") have no "data: " line and are skipped.
 */
export function parseSse(buffer: string): { events: TraceEvent[]; rest: string } {
  const frames = buffer.split("\n\n");
  const rest = frames.pop() ?? "";
  const events: TraceEvent[] = [];
  for (const frame of frames) {
    for (const line of frame.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      try {
        events.push(JSON.parse(line.slice(6)) as TraceEvent);
      } catch {
        // a malformed frame is dropped, never thrown: the panel must keep rendering
      }
    }
  }
  return { events, rest };
}

/** Append-only trace list. Same id = the new event supersedes the old one in place. */
export function upsertEvent(list: TraceEvent[], e: TraceEvent): TraceEvent[] {
  const i = list.findIndex((x) => x.id === e.id);
  if (i === -1) return [...list, e];
  const next = list.slice();
  next[i] = e;
  return next;
}
