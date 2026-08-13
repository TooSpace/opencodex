#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node --test "$ROOT/prototype/tool-discovery-profile.test.mjs"
node "$ROOT/prototype/payload-benchmark.mjs" 250
node "$ROOT/prototype/payload-benchmark.mjs" 1000
