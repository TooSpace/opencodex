# 053 - Prompt-cache scenarios

## Stable-manifest invariant

Hash the model-visible top-level tool list for every request in one session. It should not change when:

- an MCP server connects late;
- one deferred tool is loaded;
- a tool is temporarily unavailable;
- list-changed fires.

Where a protocol mandates dynamic declarations, record the exact append/mutation and cache effect.

## Cache chain assertion

When provider usage exposes cache metrics:

```text
expected next cache read ≈ previous cache read + previous cache creation
```

Large unexplained collapse indicates prefix mutation or TTL loss.

## Scenarios

- late LSP/tool availability;
- one-tool discovery;
- batch discovery of 1/3/5/10 tools;
- dynamic server reconnect;
- compaction boundary;
- idle inside short versus long cache TTL.

## Product rule

Do not optimize only turn-1 bytes while causing repeated full-prefix cache rebuilds later. Evaluate total session cost.
