#!/usr/bin/env bash
set -euo pipefail

# Run from the root of a clean OpenCodex checkout after applying the draft patch.
if [[ ! -f package.json || ! -d src/codex ]]; then
  echo "error: run this script from the OpenCodex repository root" >&2
  exit 2
fi

bun run typecheck

bun test \
  tests/codex-tool-discovery-mode.test.ts \
  tests/catalog-cursor-search.test.ts \
  tests/codex-catalog.test.ts \
  tests/config.test.ts \
  tests/config-user-edits.test.ts \
  tests/e2e-style/phase100-native-parity.test.ts

# Full regression and privacy gates used by the repository.
bun run test
bun run privacy:scan
