---
description: Add or repair ONE vendor adapter without touching the verdict. The master checklist; vendor-specific steps are in the wire-* workflows
argument-hint: "<vendor>"
---

# Wire an integration: $ARGUMENTS

1. **Read the vendor docs page** (list in the `research-web` skill), not a summary and not your memory. Check the installed package's `.d.ts` for SDK vendors.
2. **Flag**: add `CAP_<ID>` and the credentials to `lib/env.ts` (zod) and `env.example`; add the capability to `CAPABILITY_IDS` / `CAPABILITIES` in `lib/integrations/registry.ts` with an honest "when off" note.
3. **Adapter**: `lib/integrations/<vendor>.ts`, following rule 80 exactly: `isOn` -> `guard` -> timeout -> zod parse in a PURE exported function -> `minorFromJson` for prices.
4. **Pure-function test**: `<vendor>.test.ts` for the parser/builder (see `channel3.test.ts`). No network in tests.
5. **Prove the OFF path**: `CAP_X=0`, run the demo path, nothing throws.
6. **Prove the FAILURE path**: a bad key; a `degraded` row appears in the trace; the verdict is still computed; a blind spot is WAIT, not RELEASE.
7. **Only then wire the ON path** into an agent (usually `resolver`, `nudger`, `explainer`, `archivist`) via `traced(...)`.
8. Add the vendor row to `docs/INTEGRATIONS.md` (what it does, what happens when off, how to demo it).
9. `npm run verify`, `/review-diff`, commit `integration: <vendor> adapter`.

## The failure you are most likely to make

Writing the endpoint/header/field from memory. Every adapter in `reference/lib/integrations/` was checked against docs or `.d.ts`.
If a call 4xx's, re-read the page; do not "try variations".
