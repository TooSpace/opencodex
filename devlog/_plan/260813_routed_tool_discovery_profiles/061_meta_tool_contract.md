# 061 - Meta-tool contract

## `ocx_tool_search`

Input:

```json
{
  "query": "browser screenshot",
  "namespace": "browser",
  "limit": 10,
  "cursor": null
}
```

Output:

```json
{
  "matches": [
    {
      "name": "mcp__browser__take_screenshot",
      "namespace": "mcp__browser",
      "shortName": "take_screenshot",
      "description": "Capture the current page"
    }
  ],
  "hasMore": false,
  "nextCursor": null,
  "indexGeneration": 7
}
```

No full JSON Schema in search output.

## `ocx_tool_describe`

Input contains one to three exact qualified names. Output returns schemas plus manifest/index generation. Unknown names return per-item errors.

## `ocx_tool_call`

Input:

```json
{
  "name": "mcp__browser__take_screenshot",
  "arguments": { "fullPage": true },
  "expectedIndexGeneration": 7
}
```

Output uses the normal MCP result shape, bounded by existing result limits.

## Versioning

Every response carries contract version and index generation. Breaking changes require a new versioned tool name or negotiated field.
