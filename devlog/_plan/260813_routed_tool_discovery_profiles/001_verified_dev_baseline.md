# 001 - Verified `dev` baseline

Status: VERIFIED FROM GITHUB
Branch: `dev`
Packaging-time head: `2cdbf66a23f9fd8f2f38dcc702ccd3f2e60ac535`
Packaging-time commit: PR #1600, CI timeout/watchdog scaling
Tool-discovery semantic base: `5703473041a9f4f415743652de5d86d51fd66db5`, PR #1596

The packaging-time head has PR #1596 as a direct parent. Relevant source files were fetched again from `dev` after the CI-only head advance; the catalog policy seams documented below remained present.

## Source locations

| Concern | Current location | Verified behavior |
|---|---|---|
| Routed normalization | `src/codex/catalog/parsing.ts` | `tool_mode=code_mode_only`; Cursor false, non-Cursor true for `supports_search_tool` |
| Template-less fallback | `src/codex/catalog/sync.ts` | Repeats Cursor/non-Cursor discovery split |
| Provider metadata → catalog | `src/codex/catalog/provider-fetch.ts` | `applyProviderConfigHints()` already carries per-provider/model capability hints such as context, modalities, reasoning and parallel tools |
| Provider config type | `src/types.ts` | `OcxProviderConfig` contains provider-level and model-level capability overrides; no routed discovery override yet |
| Config schema | `src/config.ts` | `providerConfigSchema` validates known provider fields and passes unknown fields through |
| Facade exports | `src/codex/catalog.ts` | Re-exports catalog parsing/provider-fetch/sync surfaces |
| Focused tests | `tests/catalog-cursor-search.test.ts` | Pins template and fallback search advertising |
| Broad catalog tests | `tests/codex-catalog.test.ts` | Pins normalized and combo rows |
| Native-parity smoke | `tests/e2e-style/phase100-native-parity.test.ts` | Expects routed DeepSeek row to advertise search |

## Current normalization seam

The load-bearing current code is conceptually:

```ts
const isCursorEntry = typeof entry.slug === "string"
  && entry.slug.startsWith("cursor/");

if (isCursorEntry) {
  delete entry.web_search_tool_type;
} else {
  entry.web_search_tool_type = "text_and_image";
}
entry.supports_search_tool = !isCursorEntry;
```

This is not yet a capability resolver. It is a surface-name special case.

## Current provider hint seam

`applyProviderConfigHints(name, prov, model, providerCap)` is the correct place to resolve a provider/model override because it already applies:

- `modelContextWindows`
- `modelInputModalities`
- `modelMaxInputTokens`
- reasoning ladders and defaults
- reasoning-summary support
- parallel-tool-call support

A resolved `toolDiscoveryMode` carried on `CatalogModel` follows the existing architecture instead of making `normalizeRoutedCatalogEntry()` reach back into global config.

## Current gather identity seam

`providerCatalogFingerprint()` includes fields that influence catalog output. A discovery override must be added there so two different configs do not share a stale gather key. The newer `providerGraphIdentity` hashes the whole admitted provider row as a second fence, but the explicit fingerprint should still record the field because it is part of the catalog contract and testable identity.

## Baseline test commands from the repository

```bash
bun run typecheck
bun test tests/catalog-cursor-search.test.ts \
  tests/codex-catalog.test.ts \
  tests/e2e-style/phase100-native-parity.test.ts
bun run test
```

## Baseline constraint

This bundle was built without a mounted full repository checkout. The executable tests included here validate the resolver and synthetic payload model independently. The repository commands above are the required integration gate when applied in the actual OpenCodex worktree.

**Superseded on 2026-08-13:** that gate has now been run. See
`094_landing_verification_pass.md` for the re-verification of every claim above
against a real worktree, the upstream `codex-rs` source, and live GitHub state.
Eight corrections were recorded there; the ones touching this document are:
`CatalogModel` lives in `src/codex/catalog/parsing.ts`, not `src/types.ts`, and
`supports_search_tool` is gated upstream by a second conjunct
(`namespace_tools_enabled`), so it is not the sole switch for deferred discovery.
