# 062 - Meta-tool security model

## Authorization

Search, describe and call must all operate on the caller's filtered authorized catalog. A search result must never reveal a tool the same caller cannot describe or invoke.

## Dispatch

`ocx_tool_call` must reuse the existing execution path after authorization. Do not create a local-registry shortcut that bypasses:

- per-key server allowlists;
- per-tool permissions;
- IP/network policy;
- pre-call hooks/guardrails;
- logging and rate limits.

## Name handling

- exact qualified name required for call;
- no suffix fallback on ambiguous names;
- normalize once, then compare canonical names;
- reject control characters and oversized names;
- protect against `__proto__`, constructor and prototype keys.

## Input/result bounds

- search query length cap;
- maximum result count;
- describe maximum tools and schema bytes;
- call argument byte/depth limits;
- tool-result byte/token limit;
- timeouts and cancellation.

## Prompt injection

Tool descriptions and results are untrusted data. The meta-tool wrapper should label them as data, preserve provenance and avoid presenting server text as system authority.
