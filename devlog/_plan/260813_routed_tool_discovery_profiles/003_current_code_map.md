# 003 - Current code map and patch insertion points

> **Amended 2026-08-13** after re-verification in a real worktree
> (`094_landing_verification_pass.md`). Three fixes apply to this document:
> `CatalogModel` is declared in `src/codex/catalog/parsing.ts:94`, not
> `src/types.ts`; the combo rule needs
> `src/codex/catalog/aggregation.ts` (`deriveComboCatalogModel`, lines 125-177),
> which was missing from the file list below; and `providerConfigSchema` is a
> `.passthrough()` object that would not validate a new field at all.

## 1. Data model

### `src/types.ts`

Add a reusable mode type:

```ts
export type OcxRoutedToolDiscoveryMode = "auto" | "deferred" | "direct";
```

Add provider fields beside other Codex/catalog capability fields:

```ts
routedToolDiscovery?: OcxRoutedToolDiscoveryMode;
modelRoutedToolDiscovery?: Record<string, OcxRoutedToolDiscoveryMode>;
```

Why provider + model:

- one gateway can front multiple upstream models;
- one model may need a direct fallback while siblings stay deferred;
- the codebase already uses this provider/model override pattern for adapters, context, modalities and reasoning.

## 2. Catalog carrier

### `src/codex/catalog/parsing.ts`

Extend `CatalogModel` (declared here at line 94, beside `parallelToolCalls` and
`supportsReasoningSummaries` — it is **not** in `src/types.ts`):

```ts
toolDiscoveryMode?: "deferred" | "direct";
```

The catalog row should contain the **resolved** mode, never `auto`.

## 3. Resolution

### `src/codex/catalog/provider-fetch.ts`

Add:

```ts
export function configuredRoutedToolDiscoveryMode(
  name: string,
  prov: OcxProviderConfig,
  modelId: string,
): "deferred" | "direct";
```

Resolution:

```text
if Cursor adapter/provider -> direct
else model override
else provider override
else deferred
```

`auto` means current default: deferred for non-Cursor.

Apply the result inside `applyProviderConfigHints()` so configured, live-discovered, cached and combo-derived rows receive the same mode.

## 4. Catalog serialization

### `src/codex/catalog/parsing.ts`

Change:

```ts
normalizeRoutedCatalogEntry(entry, parallelToolCalls)
```

into:

```ts
normalizeRoutedCatalogEntry(
  entry,
  parallelToolCalls,
  toolDiscoveryMode,
)
```

The function still hard-fences Cursor to direct.

### `src/codex/catalog/sync.ts`

Pass `model?.toolDiscoveryMode` on the template path (line 287) and use the same
resolved value on the template-less path (lines 312-343). Both paths must emit
explicitly: the template-less fallback never calls `normalizeRoutedCatalogEntry`,
and `ensureStrictCatalogFields` silently defaults missing capability flags, so
policy must never be left to a strict-field default.

### `src/codex/catalog/aggregation.ts`

`deriveComboCatalogModel()` (lines 125-177) owns combo capability derivation. The
"any member direct → combo direct" rule from `012` is implemented here.

Avoid duplicating a second independent policy expression. A small helper such as `applyRoutedToolDiscoveryMetadata()` should own:

- `supports_search_tool`
- `web_search_tool_type`
- Cursor exception

## 5. Config admission

### `src/config.ts`

`providerConfigSchema` (lines 616-645) declares only a minority of
`OcxProviderConfig` fields and ends with `.passthrough()`; it contains no
`.catch()`. A field added only to the TypeScript interface is passed through
**unvalidated on both paths**. Both halves must be built explicitly.

Add schema fields and a strict write-boundary validator. Recommended behavior:

- malformed hand edit: degrade the optional field and warn;
- live config write/import: reject with a path-specific error;
- unknown future values: preserve only if the project intentionally chooses forward compatibility for this enum.

## 6. Gather identity

### `src/codex/catalog/provider-fetch.ts`

Add the two fields to `providerCatalogFingerprint()`:

```ts
rtd: prov.routedToolDiscovery ?? null,
mrtd: prov.modelRoutedToolDiscovery ?? null,
```

The whole-row `providerGraphIdentity` already provides a broad safety net. The explicit fingerprint keeps the older join key semantically complete and makes regression intent clear.

## 7. Tests

Note: no `tests/config*.test.ts` currently asserts routed discovery flags at all,
so the config coverage below is new work rather than an extension.

Update:

- `tests/catalog-cursor-search.test.ts`
- `tests/codex-catalog.test.ts`
- `tests/e2e-style/phase100-native-parity.test.ts`

Add:

- `tests/codex-tool-discovery-mode.test.ts`
- config degradation and write-boundary cases in `tests/config.test.ts` / `tests/config-user-edits.test.ts`

## 8. Diagnostics

A later management DTO can expose:

```json
{
  "resolvedToolDiscovery": "deferred",
  "source": "default",
  "reason": "non-Cursor Code Mode default"
}
```

Do not encode this diagnostic-only source/reason into Codex's model catalog unless the client explicitly tolerates unknown extension keys.
