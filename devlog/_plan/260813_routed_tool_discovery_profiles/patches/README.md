# Patch drafts

Target inspected: OpenCodex packaging-time `dev` at `2cdbf66a23f9fd8f2f38dcc702ccd3f2e60ac535`.
The tool-discovery semantic base is parent commit `5703473041a9f4f415743652de5d86d51fd66db5` (PR #1596).

## Recommended application path

```bash
node patches/apply-draft.mjs --check /path/to/opencodex
node patches/apply-draft.mjs /path/to/opencodex
cd /path/to/opencodex
/path/to/bundle/scripts/run-repo-validation.sh
```

`apply-draft.mjs` resolves every current-dev seam before its first write, refuses missing or
duplicate seams, adds the pure module and focused test, and then writes files atomically one by
one. Review `git diff` before testing or committing.

## Files

- `apply-draft.mjs` — preferred assertion-heavy draft applicator.
- `0001-add-tool-discovery-module.patch` — syntactically validated new-module patch.
- `0002-focused-test-plan.patch` — syntactically validated focused test patch/plan.
- `0003-route-scoped-tool-discovery.review.diff` — multi-file review diff. It is intentionally
  marked `review.diff`; use the applicator rather than assuming `git apply` compatibility.
- `proposed/src/codex/catalog/tool-discovery.ts` — complete proposed pure module.
- `proposed/tests/codex-tool-discovery-mode.test.ts` — complete proposed focused test.

## Verification boundary

- Node syntax check for `apply-draft.mjs`: passed.
- Synthetic current-seam `--check` and apply exercise: passed; see
  `results/apply-draft-synthetic-test.txt`.
- Pure resolver prototype: 17/17 passed.
- Full OpenCodex typecheck/Bun suite: not run in this artifact environment.
