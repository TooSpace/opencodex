# 033 - Tool-search history, compaction and resume

## History items to preserve

- `tool_search_call`;
- `tool_search_output`;
- discovered qualified names;
- original tool kinds;
- call ids;
- namespace metadata.

## Continuation scenario

1. model searches for Browser screenshot tool;
2. client returns search output;
3. model calls discovered tool;
4. client returns result;
5. model answers;
6. next user turn calls the same tool again.

The second turn must not lose the discovered identity or mis-serialize it as an unrelated function.

## Compaction scenario

Compact after step 3 and continue. Either:

- the discovered schema/reference is restored safely; or
- the client re-describes the exact tool from a stable index.

It must not reconstruct an argument schema from model memory.

## Resume scenario

Restart the process and resume the transcript. Reconcile persisted references against the current tool manifest. Missing tools should return a structured unavailable result, not poison every later request.

## Transient tools

Startup-only tools such as connection waiters must never become durable search references. Filter them before persistence or tag/reconcile them explicitly.
