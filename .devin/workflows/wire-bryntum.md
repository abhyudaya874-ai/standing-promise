---
description: Bryntum Scheduler timeline: one row per payer, promises as events, drag to reschedule
---

# Bryntum timeline

In the reference code: `lib/integrations/bryntum.ts` (pure mapping, tested), `components/PromiseTimeline.tsx`, `app/timeline/page.tsx`, op `reschedule` in the route.

1. Install the **trial** build under the real name (so imports stay `@bryntum/scheduler`):
   `npm install --save-exact @bryntum/scheduler@npm:@bryntum/scheduler-trial@7.3.8 @bryntum/scheduler-react@7.3.8`
2. The component imports `@bryntum/scheduler/scheduler.css` and `@bryntum/scheduler/svalbard-light.css` (both exist in the package). Bryntum touches `window`: the page loads it with `next/dynamic` `{ ssr: false }`. Do not remove that.
3. Open `/timeline`: each payer is a row, each promise a bar ending at its due date, coloured by state (`met` / `unmet` / `pending` in your CSS).
4. Drag a bar: `onAfterEventDrop` posts `{op:"reschedule"}`. The server only moves OPEN promises (409 otherwise). Prove it: drag a captured promise, check nothing changes after reload.
5. Add colours for `.b-sch-event.met|unmet|pending` in `app/globals.css`.
6. Degrade: with `CAP_BRYNTUM=0` link to the event log table instead; the home page nav should hide the Timeline link.
7. To add detail: events can carry any field; extend `toScheduler` AND its test together.
