# 010 - Phase 1: route-scoped discovery resolver

Status: IMPLEMENTATION-READY
Scope: first PR only

## Goal

Replace the hard-coded Cursor/non-Cursor Boolean with one pure resolver while preserving PR #1596 as the default.

The first PR is deliberately small. It does not implement a new tool protocol, mutate the Code Mode runtime, or auto-classify providers. It only introduces a typed route policy and a narrow compatibility escape hatch.

## Public configuration

```ts
export type OcxRoutedToolDiscoveryMode = "auto" | "deferred" | "direct";

interface OcxProviderConfig {
  routedToolDiscovery?: OcxRoutedToolDiscoveryMode;
  modelRoutedToolDiscovery?: Record<string, OcxRoutedToolDiscoveryMode>;
}
```

## Resolution order

```text
Cursor hard fence
  > exact model override
  > provider override
  > auto default
```

> **Amended 2026-08-13:** the original text said "exact/date-compatible model
> override". `modelRecordValue()` does not match `-YYYYMMDD` variants
> (`094_landing_verification_pass.md` Correction 4), and the decision is to keep
> its semantics rather than invent a bespoke matcher. An operator pinning an
> emergency escape hatch names the exact model id that failed.

Resolved values are only:

```ts
type ResolvedRoutedToolDiscoveryMode = "deferred" | "direct";
```

`auto` resolves as follows:

| Route | Result |
|---|---|
| Cursor provider name or `adapter: "cursor"` | `direct` |
| every other routed provider | `deferred` |

## Why this is the first PR

- It keeps current users on the #1596 shape.
- It gives #1522-style reproductions a route-local remediation.
- It creates a stable seam for later conformance evidence.
- It is reversible: deleting the two optional fields restores current behavior.

## Non-goals

- no automatic switch based on model brand;
- no full MCP multiplexer;
- no client-version database;
- no per-session mode mutation;
- no claim that `direct` is cheaper or preferred.
- no claim that `direct` restores *reachability* under code mode. Upstream
  installs MCP tools on the `tools`/`ALL_TOOLS` globals in both modes; `direct`
  only moves full schemas into `exec.description` at a measured payload cost
  (`004`, `094` Correction 2).

## Acceptance

1. No new config produces current catalog flags.
2. One provider override changes only that provider.
3. One model override changes only that model.
4. Cursor remains direct even when configured deferred.
5. Hosted web search remains independent.
6. The resolved mode participates in catalog gather identity.
7. The Cursor fence resolves identically on the template and template-less paths
   (provider identity first, slug prefix only as fallback) — closing the
   unresolved #1596 P2 rather than reproducing it (`094` Correction 8).
