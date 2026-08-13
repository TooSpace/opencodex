# 012 - Phase 1: catalog patch

## New pure module

Recommended file:

```text
src/codex/catalog/tool-discovery.ts
```

Owned functions:

```ts
resolveConfiguredRoutedToolDiscoveryMode(providerName, provider, modelId)
applyRoutedToolDiscoveryPolicy(entry, resolvedMode)
deriveComboToolDiscoveryMode(memberModes)
```

The executable reference implementation is included at:

```text
prototype/mvp-resolver.mjs
```

## Template path

Current:

```ts
normalizeRoutedCatalogEntry(e, model?.parallelToolCalls === true);
```

Proposed:

```ts
normalizeRoutedCatalogEntry(
  e,
  model?.parallelToolCalls === true,
  model?.toolDiscoveryMode ?? "deferred",
);
```

Inside normalization:

```ts
const isCursorEntry = typeof entry.slug === "string"
  && entry.slug.startsWith("cursor/");
const effective = isCursorEntry ? "direct" : toolDiscoveryMode;

applyRoutedCodexToolMode(entry);
entry.supports_search_tool = effective === "deferred";
```

Hosted search stays independent:

```ts
if (isCursorEntry) delete entry.web_search_tool_type;
else entry.web_search_tool_type = "text_and_image";
```

## Template-less path

The fallback in `src/codex/catalog/sync.ts` currently duplicates policy. It must consume the same resolved value:

```ts
const mode = isCursorFallback
  ? "direct"
  : model?.toolDiscoveryMode ?? "deferred";
```

Regression tests must cover both paths because #1596 already established this as a dual seam.

## Combo path

A single public combo row cannot switch catalog capabilities after selecting a target. Use the conservative composition rule:

```text
if any member is direct -> combo direct
otherwise -> combo deferred
```

This prevents a combo from advertising deferred discovery when one possible target was explicitly marked incompatible.

## Native rows

No change. Native OpenAI rows keep the upstream snapshot and their existing capability metadata.

## Serialized extensions

Do not serialize an OpenCodex-only `tool_discovery_mode` field into the Codex model catalog unless the client explicitly tolerates it. The internal `CatalogModel` field is enough; only standard Codex fields are emitted.
