# Demo script, 2:00

Pre-flight (before recording): use **USD** and a product sold in USD (PayPal cannot process INR; another currency makes the verdict WAIT with CURRENCY_MISMATCH). Two promises already created and **approved in the PayPal sandbox** (A: Channel3 price condition
the real price satisfies; B: same but the product query is gibberish). Dev server up. `CAP_*` as planned. Browser tabs: `/`, `/p?id=A`, `/board`, `/timeline`.

| t | Beat | On screen |
|---|---|---|
| 0:00 | "Conditional commitments have no enforcement." | title |
| 0:10 | One promise, one condition, one verdict computed in code. Show the capability strip. | `/` |
| 0:20 | Settle A. Trace: guard → observer (PayPal) → resolver (Channel3 + KERNEL) → source of `decide()` streams → `CONDITION_MET` → capture | `/p?id=A` |
| 0:50 | "The verdict is code, not vibes": Replay verdict → identical | replay line |
| 1:00 | KERNEL replay link: the actual merchant page | new tab |
| 1:10 | Double-click Settle: one capture, "duplicate request" | event log: one capture |
| 1:20 | Promise B: Channel3 finds nothing → red degraded row → `FACT_MISSING` (WAIT, never release) → type a price → Settle → `CONDITION_MET` | `/p?id=B` |
| 1:40 | Dashboard: pill + friendly scoreboard; ask the analyst "why was B waiting?" (or the Astropods concierge in another tab) | `/board` |
| 1:50 | Timeline: drag a bar, due date moves | `/timeline` |
| 2:00 | "The verdict is code. The proof is on screen." | end card |

## Cut order if long
1:50 timeline → 1:00 KERNEL tab → 1:40 agent question → 1:10 double-click. NEVER cut the verdict replay or the capture.

## Rehearsal gate
Two clean runs under 2:00 before recording. `/judge-mode 2` twice. Record the git tag here: `____`.
