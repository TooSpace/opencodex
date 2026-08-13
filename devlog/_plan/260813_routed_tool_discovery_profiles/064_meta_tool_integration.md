# 064 - Meta-tool integration points

## Registry

Build one session-scoped filtered index from the same registered tools used by normal execution. Keep a generation counter and stable canonical names.

## Code Mode

The meta-tools can themselves be nested under `exec` or directly visible, depending on the client profile. Do not expose both the full direct catalog and meta-tools unless intentionally evaluating them.

## Tool choice

Honor existing `tool_choice` and allowed-tool predicates. A denied underlying tool must not become callable through `ocx_tool_call`.

## History

Persist only exact selected names and normal tool-call/result records. Search result bodies can be compacted or reissued from the current index.

## Dynamic updates

On `tools/list_changed`, rebuild/patch the side index and increment generation without mutating the top-level model tool manifest.

## Observability

Log query count, candidate count, selected qualified name, latency and result bytes. Do not log full descriptions, schemas or arguments by default.
