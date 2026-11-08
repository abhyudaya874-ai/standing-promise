---
name: ui-trace
description: Build and maintain the live trace panel: tool rows, subagent cards, streaming source view, degraded rows
argument-hint: "<panel or state>"
allowed-tools:
  - read
  - grep
  - glob
  - edit
triggers:
  - user
  - model
---

Work on: $ARGUMENTS. The trace panel is the product's proof. It renders what the system actually did, as it happens.
To add an event kind use `.devin/workflows/add-trace-event.md`.

## Event shape (single source: `lib/agent/types.ts`)

`tool | subagent | diff | thought | verdict | error | done`, rendered by ONE switch in `components/TracePanel.tsx`.

## Rules

- Append-only: same `id` supersedes in place (`upsertEvent` in `lib/sse.ts`). A settled event never mutates.
- Every running state has an exit (agent caps guarantee it). A spinner with no exit is worse than none.
- Errors render INLINE in the row, never as a toast or alert.
- No layout shift when an event settles: rows have a fixed `min-h`.
- A degraded vendor is a normal `tool` row in the error state plus a dim `thought`: "Degraded: channel3.search: channel3 off".
- The panel never blocks the composer. If the stream drops, existing rows stay and one error row appears.

## Example: how a degraded vendor looks in the stream

```
subagent resolver   running
tool     channel3.search {"query":"running shoes"}   error  channel3 off
thought  Degraded: channel3.search: channel3 off
subagent resolver   ok 41ms
verdict  FACT_MISSING
```
