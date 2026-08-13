# 041 - Code Mode `tools` / `ALL_TOOLS` canary

## Preconditions

- non-Cursor routed model;
- catalog row has `tool_mode=code_mode_only` and search true;
- at least one test MCP server exposing a harmless deterministic tool.

Recommended tool:

```text
mcp__ocx_canary__echo({"value":"CANARY_42"})
```

## Arm A — exact internal name supplied

Prompt directly names the tool. This verifies reachability, not discovery.

## Arm B — capability-only prompt

```text
Use the available canary capability to echo CANARY_42. Do not simulate it.
```

This verifies acquisition from the visible Code Mode metadata.

## Arm C — search within `ALL_TOOLS`

Ask the model to inspect the tool index by name/description and invoke the match. Capture whether it uses `exec` and the correct `tools.*` function.

## Assertions

- `ALL_TOOLS` contains the canary;
- `tools.mcp__ocx_canary__echo` exists;
- call executes once;
- result contains exact sentinel;
- final response includes sentinel;
- no direct/eager schema dump appears in the first request.
