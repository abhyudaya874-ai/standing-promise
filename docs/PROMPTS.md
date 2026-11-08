# PROMPTS: copy-paste for a small model

## 0. Paste this at the start of EVERY new session

```
Run /start-session. Then read docs/CODEMAP.md. Do not write code yet. Report the TREE / LAST WORK / GATE / CAPS ON / NEXT box.
```

## 1. The slice prompt (fill the blanks)

```
Task: <one sentence>.
Follow .devin/workflows/feature-slice.md.
Before editing, fill GOAL / FILES (max 2) / PATTERN (from docs/PATTERNS.md) / CHECK and show them to me.
Use only names that exist in docs/CODEMAP.md. Keep every @invariant marker. Run npm run verify:fast after each edit.
```

## 2. Day prompts

| Day | Prompt |
|---|---|
| 1 | `Run /bootstrap. Stop and ask me for DATABASE_URL and the PayPal sandbox keys. Do not invent any.` |
| 2 | `Run /feature-slice "settle happy path". Use a sandbox buyer I approve manually. Show me the event log after.` |
| 3 | `Run /wire-world-condition. I will give you the Channel3 and KERNEL keys. Prove the degraded path too.` |
| 4 | `Run /wire-studio-dashboard, then /wire-bryntum, then /wire-zapier, one at a time, verify between each.` |
| 5 | `Run /wire-render, /postman-setup, /apimatic-verify-paypal.` |
| 6 | `Run /demo-freeze.` |
| submit | `Run /release-check and report each numbered item pass/fail.` |

## 3. When you are stuck (the model pastes this to itself)

```
STOP. Write three lines: TRIED: ... / SAW: <the exact error> / NOW SUSPECT: ...
Then re-read the file the error names IN FULL, and look up every name I used in docs/CODEMAP.md.
Do not try a third variation of the same idea.
```

## 4. "Add a vendor" prompt
```
Wire <vendor>. Follow .devin/workflows/integration-wire.md and the matching wire-* workflow.
Read the vendor docs page FIRST (research-web skill) and the installed package .d.ts. Do not write any endpoint, header or field from memory.
Prove CAP_<ID>=0 and a bad key before wiring the ON path.
```

## 5. "Add a reason code" prompt
```
Run /add-reason-code "<CODE> fires when <situation>". Test row first, then verdict.ts, then ARCHITECTURE.md, then explainer FALLBACK.
```

## 6. Review prompt
```
Run /review-diff. Remember: unknown must never become RELEASE, vendors only through guard(), user URLs through assertPublicHttpUrl.
```
