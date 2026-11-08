#!/usr/bin/env bash
# Stop hook: tell the agent when it is about to finish with unverified changes.
set -euo pipefail
. "$(dirname "$0")/_lib.sh"
if [ ! -f .devin/.last-verify ]; then
  echo "No full verify recorded. Run: npm run verify  (before saying you are done)." >&2
  exit 0
fi
if source_newer_than_verify; then
  echo "Source changed since the last full verify. Run: npm run verify" >&2
fi
exit 0
