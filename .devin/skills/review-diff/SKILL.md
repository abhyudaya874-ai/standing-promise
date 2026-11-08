---
name: review-diff
description: Adversarial review of staged changes before commit
agent: promise-reviewer
triggers:
  - user
---

Review the staged diff. Assume it is wrong.

Check in order: determinism, idempotency, money, failure modes, blind spots (could "unknown" become RELEASE?), invariants,
security (user URLs, secrets), scope, naming. Use the reviewer output contract with a
`VERDICT: ship | ship-with-fixes | rework` line. `rework` means the shape is wrong: say what shape you wanted.

Cap at 12 findings. If the diff is bigger, say "diff too big" before listing anything.
