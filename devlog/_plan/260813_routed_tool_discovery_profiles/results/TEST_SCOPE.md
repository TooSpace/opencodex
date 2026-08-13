# Test scope and limitations

## Executed here

```bash
node --test prototype/tool-discovery-profile.test.mjs
```

Result: 17 passed, 0 failed.

Executed synthetic structural benchmarks:

```bash
node prototype/payload-benchmark.mjs 250
node prototype/payload-benchmark.mjs 1000
```

## Not executed here

- `bun run typecheck`;
- focused OpenCodex Bun tests;
- full OpenCodex test suite;
- Codex CLI/App live canary;
- Browser plugin E2E;
- real request/token/cache capture.

Reason: this artifact runtime has no Bun installation and external DNS is blocked, so the full repository could not be cloned. Source and patches were inspected through the connected GitHub integration.

## Required next validation

Run `scripts/run-repo-validation.sh` inside a clean OpenCodex `dev` worktree after applying the patch. Then perform the scenarios in `040`–`049` on machines with real client/plugin credentials.
