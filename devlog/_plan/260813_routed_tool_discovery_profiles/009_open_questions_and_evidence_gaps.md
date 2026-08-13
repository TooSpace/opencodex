# 009 - Open questions and evidence gaps

## E1 — Exact #1522 pairing

Still required:

```text
Codex App
+ Browser plugin
+ DeepSeek-compatible external model
+ current dev catalog
+ supports_search_tool=true
+ code_mode_only
```

Need to capture:

- client version;
- catalog row;
- first request tool metadata;
- `ALL_TOOLS` listing;
- whether `mcp__node_repl__js` exists on `tools`;
- actual model call;
- result event;
- payload bytes.

## E2 — App versus CLI parity

The live canary in #1596 used routed Kimi through a CLI-style execution path. Codex App plugin initialization and task lifecycle may differ. This must not be inferred away.

## E3 — Dynamic tool updates

Determine whether the current Codex build refreshes Code Mode `ALL_TOOLS` after MCP `tools/list_changed`, or whether a new session/isolate is required.

## E4 — Compaction and resume

Determine which items persist:

- tool-search outputs;
- loaded tool definitions;
- namespace metadata;
- Code Mode registry state;
- transient tool references.

## E5 — Acquisition quality by model

Run identical task batteries with:

- required tool already visible;
- required tool deferred in `ALL_TOOLS`;
- required tool behind `ocx_tool_search`.

Measure tool acquisition, user-question fallback, invented workaround and false impossibility rates.

## E6 — Direct-mode practical bounds

Direct mode is currently an escape hatch, but safe limits are not yet defined. Measure realistic plugin sets and establish warning/failure thresholds for:

- tool count;
- schema bytes;
- `exec.description` bytes;
- total first-request bytes.

## E7 — Automatic profile promotion

Do not implement automatic profile selection until evidence has:

- a versioned suite id;
- client and adapter scope;
- last-verified timestamp;
- pass/fail result;
- expiry policy.

Until then, defaults plus explicit override are more trustworthy.
