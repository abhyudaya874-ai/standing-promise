# UI spec

Two things borrowed: Perplexity's transparency about what the machine is doing, Devin's commitment to showing the work.

## Pages

| Route | What |
|---|---|
| `/` | composer (title, amount, payer, condition picker) + capability strip (each vendor on/off) + links |
| `/p?id=` | the promise surface: terms, verdict card, Settle, Approve in PayPal, Replay verdict, manual entry, event log, trace panel |
| `/board` | AG Studio dashboard (verdict pill, promise scoreboard, charts, grid) + agent chat |
| `/timeline` | Bryntum Scheduler: row per payer, bar per promise, drag to reschedule |

## `/p` layout
```
┌──────────────────────────────────────────────┬───────────────────┐
│ title · amount · window · state              │ trace panel       │
│ verdict card (reason + consequence + diag)   │  append-only      │
│ [Approve in PayPal sandbox] [Settle promise] │  event stream     │
│ [Replay verdict] manual entry (if condition) │  ≤ 380px wide     │
│ event log                                    │                   │
└──────────────────────────────────────────────┴───────────────────┘
```

## Trace grammar

| Event | Visual |
|---|---|
| tool | mono name, args on one line, ms right, state dot. A degraded vendor is a RED row with its reason |
| subagent | card: id badge, title, ms |
| diff | the REAL source of `decide()` from `lib/verdict.ts`, streamed 6 lines at a time, then a `+n −0` badge |
| thought | dim italic ≤ 3 lines (degradation notes, explanation, in-app nudge banner) |
| verdict | reason code |
| done | final state, `(duplicate request, first result returned)` when deduped |
| error | inline red |

## Rules
Append-only (same id supersedes). No layout shift (fixed row min-height). Errors inline, never toast. The panel never blocks the composer.
Everything in the panel is real: no mocked events. Colour: green = met, amber = indeterminate, red = unmet/error.
The scoreboard is friendly ("on track / waiting / missed it"), never a collections report.
