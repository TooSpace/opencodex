# 043 - Cursor and bounded direct scenarios

## Cursor regression

Verify current behavior remains:

- no deferred discovery advertisement;
- no hosted-search advertisement through the OpenCodex sidecar;
- existing Cursor MCP caps apply;
- parallel tool behavior unchanged.

## Direct-mode bounds

For a non-Cursor explicit direct override, test tool surfaces at:

```text
10 / 50 / 100 / 250 / 500 tools
```

Record:

- visible tool count;
- schema bytes;
- `exec.description` bytes;
- total request bytes;
- model latency to first tool call;
- whether the model chooses the correct tool.

## Safety policy

Initial PR may warn only. A later bounded-direct profile should enforce configured caps such as:

```json
{
  "mcpMaxTools": 100,
  "mcpMaxSchemaBytes": 131072
}
```

When the catalog exceeds the bound, fail explicitly or route through meta-tools. Never silently truncate without `has_more`/diagnostics.
