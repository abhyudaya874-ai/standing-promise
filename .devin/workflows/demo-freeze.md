---
description: Day-6 freeze. No new surface, only failure paths and states
---

# Demo freeze

1. **Declare.** Commit `infra: freeze`. After it only bug fixes land.
2. **Harden.** `/hardening-pass` across the surface (12 checks). Deferring a double-capture bug is not allowed.
3. **Rehearse.** `/judge-mode 2` twice. Two clean runs under two minutes before anything is recorded.
4. **Resilience on camera.** Kill the network mid-capture; kill one vendor at a time (flip its `CAP_*` to 0 live); reload mid-flow. Each must degrade, not break.
5. **Data.** Reset the demo DB to a known-good state and snapshot it (a Neon branch). A demo that depends on accumulated junk is not frozen.
6. **Lock.** Tag the commit; record the tag in `docs/DEMO-SCRIPT.md`.
