#!/usr/bin/env bash
# Copies reference/ into the real project WITHOUT overwriting anything that already exists.
# Run from the repo root of your Next.js app (after create-next-app). Then follow docs/BOOTSTRAP.md.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
cd "$here/reference"
find . -type f ! -name 'README.md' | while read -r f; do
  dest="$here/${f#./}"
  mkdir -p "$(dirname "$dest")"
  if [ -e "$dest" ]; then echo "skip (exists)  ${f#./}"; else cp "$f" "$dest"; echo "installed      ${f#./}"; fi
done
