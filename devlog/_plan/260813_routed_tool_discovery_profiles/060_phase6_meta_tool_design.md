# 060 - Phase 6: bounded MCP meta-tool fallback

Status: DESIGN; DO NOT MIX INTO PR A

## Purpose

Provide a constant-size discovery surface for routes where native deferred discovery is unavailable or model compliance with Code Mode is poor.

## Always-visible tools

```text
ocx_tool_search
ocx_tool_describe
ocx_tool_call
```

The complete authorized catalog remains server-side.

## Flow

```text
model -> search short metadata
      -> describe 1-3 selected schemas
      -> call exact qualified name
      -> normal authorization/execution/logging
```

## Why three tools

- search output stays small and cache-stable;
- describe makes schema loading explicit and bounded;
- call can preserve permissions and tool identity without mutating the top-level tool array.

## Non-goal

This is not a second unrestricted code execution environment. `ocx_tool_call` dispatches through existing MCP authorization and validation.
