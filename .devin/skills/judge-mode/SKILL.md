---
name: judge-mode
description: Rehearse the demo against the pitch clock and stress the beats a judge will interrupt
argument-hint: "<minutes>"
triggers:
  - user
---

Run the demo as a judge, in $ARGUMENTS minutes.

1. Play `docs/DEMO-SCRIPT.md` start to finish without stopping. Time every beat; call out any beat over budget.
2. Run it again, interrupting at the three weakest points with the questions a judge would actually ask.
3. Score.

## Questions judges ask (have an answer ready)

| Question | Where the answer is on screen |
|---|---|
| "Is the verdict an LLM?" | Streaming source view of `decide()` + "Replay verdict: identical" |
| "What if Channel3/KERNEL is down?" | Turn a flag off live: degraded row, verdict WAITs, manual entry works |
| "Can it double-charge?" | Double-click Settle: one capture row, trace says duplicate request |
| "Where does Elastic/Render/Astropods fit?" | Home page capability strip + `docs/INTEGRATIONS.md` table |

## Scoring (x/5 each)

Legibility · Determinism (verdict visibly from code) · Resilience · Time · Claim hygiene (every claim has an on-screen artifact).

## Output

```
BEATS: <n> — <over/under budget each>
BREAKS: <what, and whether it was graceful>
WEAK POINTS: <the three interruption points, ranked>
CUTS: <what to drop to buy margin>
SCORE: <x>/5 per dimension
```
A break that needs a code fix is blocking. A claim without a visible artifact gets cut or gets an artifact. Overrun > 15% means the script is wrong.
