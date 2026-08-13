# Patch drafts

> **Do not apply these drafts as-is (2026-08-13).** An independent audit of the
> landing verification pass found that `apply-draft.mjs` and
> `0003-route-scoped-tool-discovery.review.diff` faithfully reproduce the
> **template/fallback Cursor-fence asymmetry** described in
> `094_landing_verification_pass.md` Correction 8 — the template path keeps
> `entry.slug.startsWith("cursor/")` while the fallback keeps
> `model?.provider === "cursor"`. The applicator still reports `draft seams: OK`,
> because it only asserts that the seams it expects are present; it does not know
> the policy is inconsistent.
>
> These files remain in the unit as the *seam inventory* that made the real
> implementation cheap to plan. The implementation PR resolves the fence from
> provider identity through one shared helper used by both paths, per the amended
> `012`, and its diff will therefore not match these drafts.

Target inspected: OpenCodex packaging-time `dev` at `2cdbf66a23f9fd8f2f38dcc702ccd3f2e60ac535`.
The tool-discovery semantic base is parent commit `5703473041a9f4f415743652de5d86d51fd66db5` (PR #1596).

## Status: ARCHIVAL — do not apply

These drafts are retained as the **seam inventory** that made the implementation
cheap to plan. They are not an application path, and the commands that used to be
recommended here have been withdrawn, because `apply-draft.mjs` writes the
Cursor-fence asymmetry described in `094` Correction 8 while reporting
`draft seams: OK`.

`apply-draft.mjs` remains useful for reading: it resolves every then-current `dev`
seam before its first write and refuses missing or duplicate seams, so its
`replaceOnce` anchors are an accurate map of where the real change lands. Read it;
do not run it against a repository you intend to commit from.

The implementation PR resolves the fence from provider identity through one shared
helper used by both the template and template-less paths, so its diff will not
match these drafts.

## Files

- `apply-draft.mjs` — assertion-heavy draft applicator. **Archival: do not run.**
  Reproduces the `094` Correction 8 fence asymmetry while reporting seams OK.
- `0001-add-tool-discovery-module.patch` — syntactically validated new-module patch.
- `0002-focused-test-plan.patch` — syntactically validated focused test patch/plan.
- `0003-route-scoped-tool-discovery.review.diff` — multi-file review diff. It is intentionally
  marked `review.diff`: it is for reading, not for `git apply`, and it carries the same
  fence asymmetry as the applicator.
- `proposed/src/codex/catalog/tool-discovery.ts` — complete proposed pure module.
- `proposed/tests/codex-tool-discovery-mode.test.ts` — complete proposed focused test.

## Verification boundary

- Node syntax check for `apply-draft.mjs`: passed.
- Synthetic current-seam `--check` and apply exercise: passed; see
  `results/apply-draft-synthetic-test.txt`.
  Note: that pass proves seam resolution only. It does **not** evaluate policy
  correctness, which is why the asymmetry survived a green `--check`.
- Pure resolver prototype: 17/17 passed.
- Full OpenCodex typecheck/Bun suite: not run in this artifact environment.
