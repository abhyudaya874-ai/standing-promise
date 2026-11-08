---
description: After a bad session, extract one rule change instead of regret
---

# Post-mortem

1. **Timeline**: what was attempted, in order; mark the moment it went wrong.
2. **Classify**: *missing rule* (nothing said not to) · *ignored rule* (it existed; why was it overridden?) · *wrong tool* · *bad plan* (units not independently verifiable) · *small-model slip* (invented a name, guessed an API).
3. **Extract ONE change in the right layer**
   - missing rule → `.devin/rules/`
   - ignored rule → tighten the hook or `check-invariants.mjs`, not the prose
   - wrong tool → fix the profile's `allowed-tools` or the skill's `agent:`
   - bad plan → fix the decomposition rule in `/orchestrate`
   - small-model slip → add the wrong→right pair to `docs/ANTI-PATTERNS.md` and the name to `docs/CODEMAP.md`
4. **Prove**: the change must make the failure impossible or loud, not just discouraged.
5. **Record** one paragraph under "Lessons" in `docs/BACKLOG.md`.
