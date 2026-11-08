---
name: runtime-agents
description: Work on the app's own runtime subagents in lib/agent (guard, observer, resolver, reconciler, explainer, nudger, archivist)
argument-hint: "<agent or change>"
allowed-tools:
  - read
  - grep
  - glob
  - edit
  - exec
triggers:
  - user
  - model
---

Work on: $ARGUMENTS. Read `.devin/rules/60-agent-layer.md` and `reference/lib/agent/README.md` first.
Adding an agent: `.devin/workflows/add-subagent.md`.

## The 5 rules to hold in your head

1. Agents return typed DATA. They never call or import `computeVerdict`, never build a Verdict.
2. `onFailure` in `registry.ts` is the policy: `abort` (guard), `degrade` (observer, resolver), `ignore` (the rest).
3. Check `signal.aborted` after every await. Every call goes through `traced(...)` so it shows in the panel.
4. A blind spot becomes `{kind:"unavailable"}`, which the verdict turns into WAIT. Never RELEASE.
5. Vendors only through `lib/integrations/*`, only via `attempt(...)` in the resolver (it logs `degraded` events).

## Where each agent plugs in

`Cycle.gather()` = guard -> observer -> resolver -> reconciler. `Cycle.decorate(verdict, guard)` = explainer + nudger + archivist.
