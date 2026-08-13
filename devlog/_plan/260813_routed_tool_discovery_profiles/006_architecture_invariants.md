# 006 - Architecture invariants

## INV-1 — Default behavior stays #1596-compatible

Without a new config field, generated catalogs must be byte-equivalent for the affected discovery fields:

- Cursor: direct
- non-Cursor: deferred

## INV-2 — Code Mode and deferred discovery move together

A non-Cursor `deferred` row must have:

```json
{
  "tool_mode": "code_mode_only",
  "supports_search_tool": true
}
```

A regression changing only one side must fail tests.

## INV-3 — Hosted web search is independent

`web_search_tool_type` describes the OpenCodex hosted-search sidecar. It is not the same capability as MCP/plugin discovery. Direct discovery on a non-Cursor provider may still advertise hosted web search.

## INV-4 — Cursor remains hard-fenced

Cursor's custom transport bypasses the relevant sidecar/deferred path. A config attempting to force Cursor deferred should either:

- be rejected at the write boundary, or
- resolve to direct with an explicit warning.

Silent acceptance is not allowed.

## INV-5 — Model override wins provider override

This follows existing `modelXxx` configuration conventions and allows one incompatible model on a mixed gateway to fall back without penalizing siblings.

## INV-6 — `auto` is resolved before serialization

`CatalogModel.toolDiscoveryMode` carries only `deferred` or `direct`. Codex never sees the internal `auto` state.

## INV-7 — Catalog gather identity includes the policy

Changing discovery mode must invalidate or separate cached catalog gathers.

## INV-8 — Direct mode is observable and bounded

Because direct mode can inflate `exec.description`, the runtime or management surface must report:

- resolved mode;
- provider/model source;
- approximate visible tool/schema count when available;
- a warning when configured bounds are exceeded.

## INV-9 — Protocol converters never silently drop tool types

Unsupported tool shapes must produce an explicit compatibility error or select a fallback profile. A normal `response.completed` after stripping tools is unacceptable.

## INV-10 — Session-visible top-level tool manifests should remain stable

Dynamic changes should update a side index or local Code Mode registry where possible, not mutate the prompt-prefix tool array repeatedly.

## INV-11 — Transient tools do not become durable references

Startup-only or connection-only tools must be filtered from persisted search results or marked non-durable and reconciled before replay.

## INV-12 — Exact E2E evidence outranks model-brand assumptions

A model name, provider label or marketing claim is not sufficient to select native discovery. Selection requires either a client-side Code Mode guarantee or a passing adapter/client conformance suite.
