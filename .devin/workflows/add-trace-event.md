---
description: Add a trace event kind end to end: type, producer, panel row, parser test
argument-hint: "<event kind>"
---

# Add a trace event kind: $ARGUMENTS

1. `lib/agent/types.ts`: add a variant to `TraceEvent` with a unique string `kind` and an `id: string`.
2. Producer: call `ctx.emit({...})` from an agent or the route. Same `id` supersedes in place.
3. `components/TracePanel.tsx`: add a `case` to the ONE switch in `Row`. TypeScript flags the switch as non-exhaustive until you do.
4. Fixed `min-h-7` row, errors inline, no animation over 180 ms.
5. `lib/sse.test.ts`: add a round-trip case for the new kind.
6. `npm run verify`.

## Worked example: a `snapshot` event that shows which vendor answered

```ts
// types.ts
| { kind: "snapshot"; id: string; source: string; evidenceUrl: string | null }
// resolver.ts, after the insert
ctx.emit({ kind: "snapshot", id: nextId("snap"), source, evidenceUrl });
// TracePanel.tsx
case "snapshot":
  return <div className={row}><Dot s="ok" /><span>snapshot from <code>{e.source}</code></span>
    {e.evidenceUrl && <a className="ml-auto underline" href={e.evidenceUrl} target="_blank" rel="noreferrer">evidence</a>}</div>;
// sse.test.ts
it("round-trips a snapshot event", () => { const e = { kind: "snapshot", id: "s1", source: "kernel", evidenceUrl: null } as const;
  expect(parseSse(encodeSse(e)).events).toEqual([e]); });
```
