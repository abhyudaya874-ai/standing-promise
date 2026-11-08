# Standing Promise

PayPal AI Hackathon entry. A payer commits an amount and an optional world condition (a product price, a page's text);
a **pure function** computes the verdict; the verdict carries its own consequence (CAPTURE / RELEASE / WAIT);
the route performs it against the PayPal **sandbox**. Next.js 15 / TypeScript / Tailwind / Drizzle / Neon.
Ten sponsors are wired behind `CAP_*` flags (AG Studio, Channel3, KERNEL, Elastic, Bryntum, Astropods, Render, Zapier, APIMatic, Postman).

**Deadline: 2026-11-13 01:30 IST.** Six build days (Fri 6 Nov → Wed 11 Nov), submission day Thu 12 Nov.
Every decision is measured against "does this survive to the demo."

You are probably a small model. Read `.devin/rules/50-small-model-protocol.md` first. It is short and it saves you.

## The seven laws (a hook or a script enforces each one)

1. **Verdicts are pure.** `lib/verdict.ts` imports nothing, reads no clock, calls no network. Time comes in as `nowMs`.
2. **Money is integer minor units.** Strings only at the edges, via `lib/money.ts`.
3. **Agents gather, they never decide.** `lib/agent/**` never mentions `computeVerdict`.
4. **Sandbox only.** A live key or `api.paypal.com` is a bug.
5. **`npm run verify` is green before every commit.** A hook blocks `git commit` otherwise.
6. **Vendors produce snapshots, never verdicts.** Adapters live in `lib/integrations/*`, return `AdapterResult`, run inside `guard()`, and sit behind a `CAP_*` flag. "Could not see" is WAIT, never RELEASE.
7. **Never write a vendor endpoint, header or field from memory.** Read the docs page or the package `.d.ts` first (`research-web` skill).

## Read order (new session or lost context)

1. `/start-session` (does steps 2–4 for you and reports state)
2. `docs/CODEMAP.md` — every file, its exports, exact signatures. **Do not invent names; look them up here.**
3. `docs/PATTERNS.md` — copyable recipes for the 12 things you will actually do.
4. `docs/ANTI-PATTERNS.md` — wrong → right pairs. Scan before reporting done.

## Where things live

| Need | Go to |
|---|---|
| Protected files + invariants with real code | `.devin/rules/00-money-path.md` |
| Determinism contract, closed reason codes | `.devin/rules/10-no-llm-verdicts.md` |
| Scope gate, pre-approved files, examples | `.devin/rules/20-four-files.md` |
| Env, migrations walkthrough, secrets | `.devin/rules/30-db-and-secrets.md` |
| Commit format, budget, dated timebox | `.devin/rules/40-commit-and-budget.md` |
| How to behave as a small model | `.devin/rules/50-small-model-protocol.md` |
| The app's runtime subagents | `.devin/rules/60-agent-layer.md` + `reference/lib/agent/README.md` |
| Tests | `.devin/rules/70-testing.md` |
| Vendors / sponsors | `.devin/rules/80-integrations.md`, `docs/INTEGRATIONS.md`, `/integration-wire`, `/wire-*` |
| Setup from scratch | `/bootstrap`, `docs/BOOTSTRAP.md` |
| Copy-paste prompts | `docs/PROMPTS.md` |
| Choices that differ from the original rules, and why | `docs/DECISIONS.md` |
| Multi-step work | `/orchestrate` |
| Step-by-step procedures | `.devin/workflows/*` (start-session, bootstrap, feature-slice, add-reason-code, add-subagent, add-trace-event, schema-change, bug-triage, integration-wire, wire-world-condition, wire-studio-dashboard, wire-studio-agent, wire-bryntum, wire-elastic, wire-zapier, wire-render, wire-astropods, apimatic-verify-paypal, postman-setup, demo-freeze, release-check, post-mortem) |
| Capabilities | `.devin/skills/*` (explore-codemap, ship-slice, verify-loop, review-diff, research-web, paypal-sandbox, neon-drizzle, ui-trace, runtime-agents, integrations, hardening-pass, judge-mode) |

## Default loop

`/explore-codemap` → `/ship-slice` → `/verify-loop` → `/review-diff` → commit.
More than 2 files or more than 1 unknown → `/orchestrate`. Known procedure (new reason code, new agent…) → the matching workflow.

## Subagents that BUILD the app

| Profile | Use for | Writes? |
|---|---|---|
| `promise-scout` | reading, tracing, web research | no |
| `promise-editor` | implementing ONE slice | yes, ≤ 2 files |
| `promise-verifier` | running the gate, reporting failures | no source edits |
| `promise-reviewer` | adversarial pre-commit review | no |
| `promise-oracle` | coordinating the above | delegates only |

Do not spawn `subagent_general` for research (it inherits the parent model and burns budget).

## Commands

```bash
npm run verify:fast   # invariants + tsc + vitest (~10s). After every edit.
npm run verify        # + next build; writes .devin/.last-verify. Before every commit.
node scripts/check-invariants.mjs   # just the mechanical rules
npx vitest run lib/verdict.test.ts  # one test file
```

## Definition of done

`npm run verify` printed "all stages passed" · review findings fixed or explicitly deferred · commit in house format ·
the 7-point self-review in rule 50 answered. "It should work" is not done; a verify run is.

## When stuck

Same error twice → STOP. Write *tried / saw / now suspect*. Re-plan or ask. Never edit a check, a test, or a hook to get green.
