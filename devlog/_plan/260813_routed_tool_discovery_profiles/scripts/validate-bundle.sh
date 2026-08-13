#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

missing=0
for n in 000 001 002 003 004 005 006 007 008 009 010 020 030 040 050 060 070 080 090; do
  if ! compgen -G "$ROOT/${n}_*.md" >/dev/null; then
    echo "missing numbered document group: $n" >&2
    missing=1
  fi
done
[[ $missing -eq 0 ]]

find "$ROOT" -type f -size 0 -print -quit | grep -q . && {
  echo "zero-length file found" >&2
  exit 1
} || true

node --test "$ROOT/prototype/tool-discovery-profile.test.mjs" >/dev/null
node "$ROOT/prototype/payload-benchmark.mjs" 10 >/dev/null

echo "bundle validation: OK"
