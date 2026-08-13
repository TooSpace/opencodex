# 020 - Phase 2: unit and integration test plan

Status: READY TO IMPLEMENT AFTER PR A

## Test pyramid

### Layer 1 — pure resolver

Fast table-driven tests with no filesystem or network.

### Layer 2 — catalog serialization

Exercise native template, routed template, template-less fallback, combo and Cursor rows.

### Layer 3 — config load/write

Prove load degradation and strict write rejection.

### Layer 4 — catalog gather/cache

Exercise provider hints, model matching, concurrency and cache invalidation.

### Layer 5 — repository E2E-style smoke

Build a catalog from a representative OpenCodex config and assert only intended rows change.

## Proposed test files

```text
tests/codex-tool-discovery-mode.test.ts
tests/catalog-cursor-search.test.ts          # extend
tests/codex-catalog.test.ts                  # extend
tests/config.test.ts                         # extend
tests/config-user-edits.test.ts              # extend
tests/e2e-style/phase100-native-parity.test.ts
```

## Local executable proof in this bundle

```bash
node --test prototype/tool-discovery-profile.test.mjs
```

Recorded result:

```text
17 tests, 17 passed, 0 failed
```

This validates the policy prototype only. It does not replace the Bun repository suite.
