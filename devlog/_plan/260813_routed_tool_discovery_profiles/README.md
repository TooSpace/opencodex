# Routed tool discovery profile investigation bundle

This folder follows the OpenCodex `devlog/_plan` convention.

## Reading order

1. `000_master_plan.md`
2. `094_landing_verification_pass.md` — **read before implementing anything**
3. `001`–`009`: verified baseline, incident history and research
4. `010`–`015`: minimal implementation patch
5. `020`–`029`: repository test plan
6. `030`–`039`: protocol conformance
7. `040`–`049`: live CLI/App scenarios
8. `050`–`059`: payload/cache benchmarks
9. `060`–`069`: bounded meta-tool fallback
10. `070`–`079`: rollout and operations
11. `080`–`089`: rollback and incident response
12. `090`–`094`: final decision, PR stack and landing verification

## Included executable artifacts

```text
prototype/mvp-resolver.mjs
prototype/profile-resolver.mjs
prototype/tool-discovery-profile.test.mjs
prototype/payload-benchmark.mjs
```

Recorded results are under `results/`.

## Verification status

- GitHub source inspection: relevant files re-fetched from packaging-time `dev` head `2cdbf66a...`; PR #1596 commit `570347304...` is its direct parent and remains the tool-discovery semantic base.
- **Worktree re-verification (2026-08-13):** performed after landing. Confirmed the
  seam map and the default-preserving stance; recorded eight corrections in
  `094_landing_verification_pass.md`, including that `CatalogModel` lives in
  `parsing.ts` rather than `types.ts`, that `aggregation.ts` was missing from the
  touch map, and that under `code_mode_only` MCP tools are callable in both
  discovery modes.
- Independent Node policy tests: executed, 17/17 passed.
- Synthetic payload benchmark: executed for 250 and 1,000 tools.
- Full OpenCodex Bun suite: not executed in this environment because the complete repository could not be cloned/materialized; the exact commands are in `scripts/run-repo-validation.sh`.
- Remote repository: not modified.

## Patch status

The `patches/` directory contains an implementation-oriented draft and proposed source/test files. It is not represented as a merged or full-suite-verified patch.
