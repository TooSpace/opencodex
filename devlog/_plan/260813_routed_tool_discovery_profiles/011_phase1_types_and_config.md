# 011 - Phase 1: types, config parsing and precedence

## Type changes

### `src/types.ts`

Add:

```ts
export type OcxRoutedToolDiscoveryMode = "auto" | "deferred" | "direct";
```

Add to `OcxProviderConfig` near the existing MCP/catalog capability fields:

```ts
/** Codex routed-row discovery policy. Default auto. */
routedToolDiscovery?: OcxRoutedToolDiscoveryMode;

/** Exact/modelRecordValue-compatible per-model override. */
modelRoutedToolDiscovery?: Record<string, OcxRoutedToolDiscoveryMode>;
```

### `CatalogModel`

Carry only the resolved value:

```ts
toolDiscoveryMode?: "deferred" | "direct";
```

This follows existing `parallelToolCalls`, `reasoningEfforts` and modality propagation. `normalizeRoutedCatalogEntry()` should not read global config.

## Config load and write behavior

OpenCodex intentionally distinguishes hand-edited load recovery from live write validation.

### Load path

Malformed optional discovery fields should degrade to undefined, preserving providers, credentials and ports. Recommended schema:

```ts
const routedToolDiscoveryModeSchema = z.enum(["auto", "deferred", "direct"]);

routedToolDiscovery: routedToolDiscoveryModeSchema
  .optional()
  .catch(undefined),
modelRoutedToolDiscovery: z.record(z.string(), routedToolDiscoveryModeSchema)
  .optional()
  .catch(undefined),
```

A warning should state that the invalid policy was ignored.

### Write path

> **Amended 2026-08-13 (`094` Correction 5 + audit blocker 3).** Two gaps between
> this section's promises and the draft in `patches/`:
>
> 1. The draft adds `.catch(undefined)` but **no load-path warning**. Silent
>    degradation is exactly the observability failure `014` exists to prevent —
>    an operator whose emergency override was dropped by a typo must be told.
>    The implementation must emit the warning, and a test must assert it.
> 2. The accessor/prototype-pollution rejection below must be established
>    **before** the validator enumerates or reads properties. A validator that
>    reaches for `candidate.providers[name].modelRoutedToolDiscovery` and only
>    then checks for getters has already run attacker-controlled code. Inspect
>    with `Object.getOwnPropertyDescriptor` and reject non-data descriptors and
>    non-own/prototype-sourced keys first, then read values.
>
> Both are first-PR requirements, not follow-ups.

`validateConfigCandidate()` must inspect the raw candidate before `.catch()` can erase the invalid value. Reject:

- unknown mode;
- non-object model map;
- blank model key;
- accessor/prototype-polluted object;
- non-string map value.

Example error:

```text
schema_invalid: providers.deepseek.modelRoutedToolDiscovery.glm-5.2:
must be auto, deferred, or direct
```

## Precedence tests

| Provider | Model | Expected | Source |
|---|---|---|---|
| unset | unset | deferred | default |
| auto | unset | deferred | provider |
| direct | unset | direct | provider |
| direct | deferred | deferred | model |
| deferred | direct | direct | model |
| deferred | auto | deferred | model auto |
| any | any on Cursor | direct | hard fence |

## Compatibility note

Do not name the field `supportsSearchTool`. That would preserve the original ambiguity between hosted web search and tool discovery. The config name must describe the actual product decision.
