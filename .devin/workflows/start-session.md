---
description: Re-orient after a new session or lost context. Read state, run the gate, report. Writes nothing.
---

# Start session

Do these in order and report in the box at the end. Do not start coding.

1. `git status` and `git log --oneline -8`: what changed recently, is the tree clean?
2. Read `AGENTS.md`, then `docs/CODEMAP.md` (the map of every file and export).
3. `cat .devin/ledger.md 2>/dev/null | sort -u | tail -20`: files touched in earlier sessions.
4. `npm run verify:fast`. Note the first failing stage if any.
5. Read the top of `docs/BACKLOG.md` ("Now").
6. `curl -s localhost:3000/api/capabilities` if the dev server is up: which vendors are on?

## Report (exactly this shape)

```
TREE:      clean | dirty (<n files>)
LAST WORK: <last commit subject>
GATE:      green | red at <stage>: <first error>
CAPS ON:   <ids or "server not running">
NEXT:      <the first item under "Now" in BACKLOG.md, or "ask the human">
```
