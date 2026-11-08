---
name: hardening-pass
description: Pre-demo hardening of failure paths and blank states, including every vendor being off or broken
argument-hint: "<surface>"
allowed-tools:
  - read
  - grep
  - glob
  - edit
  - exec
triggers:
  - user
---

Harden: $ARGUMENTS. Runs on day 6. No new surface: only failure paths and states that are currently blank.

## Checklist (12)

1. **Empty state**: a promise page with no events renders something intentional.
2. **Double submit**: click Settle twice fast. One capture, one event.
3. **Network failure**: kill PayPal. The verdict still renders; the page says capture is pending, not failed.
4. **Reload mid-flow**: refresh during capture. State recovers from the event log.
5. **Slow network**: throttle to 3G. Every button has a pending state.
6. **Second tab**: settle the same promise in two tabs. No double capture.
7. **Error copy**: no stack traces, no raw JSON in the UI.
8. **Console**: zero errors and warnings on the happy path.
9. **All vendors off**: set every `CAP_*=0`. Create, settle, capture all work. Home page shows every capability "off".
10. **One vendor broken at a time**: bad key for Channel3, then KERNEL, then Zapier, then Elastic. Each shows a `degraded` trace row; the verdict is still computed; a blind spot yields FACT_MISSING (WAIT), never RELEASE.
11. **Replay**: press "Replay verdict" on a settled promise. It says identical.
12. **SSRF**: Postman "create rejects a private URL" is green.

## Output

```
PASS: <n>/12
FIXED: <path:line — what>
DEFERRED: <item — why it is safe to defer>
```
Deferring a double-capture bug is not allowed.
