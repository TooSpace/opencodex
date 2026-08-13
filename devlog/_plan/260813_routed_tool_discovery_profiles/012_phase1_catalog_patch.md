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

Proposed. The third argument becomes an options object rather than another
positional boolean, because the fence now needs the provider identity as well as
the mode, and `normalizeRoutedCatalogEntry` has public callers (`src/codex/catalog.ts`
re-exports it, and `tests/parallel-tool-calls-optin.test.ts` calls it with one and
two arguments). Keeping both existing positions intact preserves those callers:

```ts
normalizeRoutedCatalogEntry(
  e,
  model?.parallelToolCalls === true,
  {
    toolDiscoveryMode: model?.toolDiscoveryMode ?? "deferred",
    providerId: model?.provider,
  },
);
```

Inside normalization:

```ts
// Provider identity first; the slug prefix is only a fallback for callers that
// have no CatalogModel (see the fence note below).
const isCursorEntry = isCursorRoute(entry, options?.providerId);
const effective = isCursorEntry ? "direct" : (options?.toolDiscoveryMode ?? "deferred");

applyRoutedCodexToolMode(entry);
entry.supports_search_tool = effective === "deferred";
```

The shared helper, used by both construction paths:

```ts
export function isCursorRoute(entry: RawEntry, providerId?: string): boolean {
  if (providerId !== undefined) return providerId === "cursor";
  return typeof entry.slug === "string" && entry.slug.startsWith("cursor/");
}
```

With no `CatalogModel` the slug prefix remains the only available signal, which is
why it stays as the fallback rather than being deleted.

> **Amended 2026-08-13 (`094` Correction 8).** The original draft here reproduced
> `entry.slug.startsWith("cursor/")` verbatim. That is exactly the asymmetry the
> unresolved #1596 P2 review flags: the template path fences on the public slug
> while the template-less path fences on `model?.provider === "cursor"`, so a
> `cursor/`-aliased combo whose canonical provider is `combo` is classified
> differently depending on whether a template happened to be available.
>
> Since this unit already unifies both paths behind one resolver, it must close
> the asymmetry rather than inherit it. Both paths call one shared helper that
> resolves from provider identity when a `CatalogModel` is present and falls back
> to the slug prefix only when it is not.

Hosted search stays independent:

```ts
if (isCursorEntry) delete entry.web_search_tool_type;
else entry.web_search_tool_type = "text_and_image";
```

## Template-less path

The fallback in `src/codex/catalog/sync.ts` currently duplicates policy. It must
consume the same resolved value **and the same fence helper** — using
`isCursorFallback` here is what created the asymmetry in the first place:

```ts
const isCursorEntry = isCursorRoute(entry, model?.provider);
const mode = isCursorEntry
  ? "direct"
  : model?.toolDiscoveryMode ?? "deferred";
```

`isCursorRoute()` collapses the old `isCursorFallback`
(`model?.provider === "cursor"`) and the old template-path slug check into one
expression, which is the point of Correction 8: both paths must reach the same
verdict for the same row.

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
