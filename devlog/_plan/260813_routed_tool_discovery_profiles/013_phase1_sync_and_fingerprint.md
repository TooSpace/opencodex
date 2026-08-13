# 013 - Phase 1: propagation, synchronization and cache identity

## Propagation chain

> **Amended 2026-08-13:** this chain is modeled on `parallelToolCalls`, which is a
> complete precedent for the **template** path only. The template-less fallback
> never passes it through normalization, and `ensureStrictCatalogFields`
> (`parsing.ts:293-306`) defaults a missing flag to `true`. The new field must
> emit explicitly on both construction paths and must never rely on a
> strict-field default (`094_landing_verification_pass.md` Correction 7).

```text
config.providers[name]
  -> applyProviderConfigHints(name, provider, model)
  -> CatalogModel.toolDiscoveryMode
  -> combo derivation if applicable
  -> deriveEntry()
  -> normalizeRoutedCatalogEntry()
  -> supports_search_tool
```

Each hop must be deterministic and side-effect free.

## Provider hint seam

`applyProviderConfigHints()` is the preferred resolver call site because it already handles provider and model overrides. Add:

```ts
const toolDiscoveryMode = resolveConfiguredRoutedToolDiscoveryMode(
  name,
  prov,
  model.id,
);
```

and include it in the returned `CatalogModel`.

Use `modelRecordValue()` for the per-model map so the override matches exactly
the way every sibling model-keyed override does.

> **Amended 2026-08-13:** the original sentence claimed dated variants follow the
> same behavior. They do not — `modelRecordValue()` (`src/reasoning-effort.ts:49-62`)
> matches exact own-property, the prefix before a `:`, and case-insensitively; it
> does **not** match `-YYYYMMDD` suffixes (that is `isDatedVariantId()` at
> `provider-fetch.ts:805-808`). A `glm-5.2` key will not cover `glm-5.2-20260813`.
> See `094_landing_verification_pass.md` Correction 4.

## Catalog gather identity

Add both fields to `providerCatalogFingerprint()`:

```ts
toolDiscovery: prov.routedToolDiscovery ?? null,
modelToolDiscovery: prov.modelRoutedToolDiscovery ?? null,
```

The newer provider-graph identity already hashes the admitted provider row, but the explicit fingerprint remains valuable because:

- it documents output-affecting state;
- it protects older/isolated paths;
- it creates a focused regression assertion;
- it avoids a future refactor accidentally omitting the field.

## Cache test

Start two concurrent gathers with identical transport/model lists but different discovery overrides. They must not join the same in-flight promise and must produce different catalog flags.

## Sync test

Run catalog sync twice:

1. provider default deferred;
2. change only one model to direct.

Expected:

- one row changes `supports_search_tool`;
- native rows are byte-identical;
- sibling routed rows are byte-identical;
- no stale `models_cache.json` result survives invalidation.
