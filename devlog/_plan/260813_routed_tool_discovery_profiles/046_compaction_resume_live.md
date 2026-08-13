# 046 - Live compaction and resume scenario

## Sequence

1. discover and call one deferred Browser/MCP tool;
2. grow context with deterministic text/tool results;
3. trigger compaction;
4. call the same tool;
5. close client;
6. resume session;
7. call the tool again;
8. reconnect or change MCP tool list;
9. issue one normal user turn.

## Success

- no schema reconstruction error;
- no missing namespace;
- no invalid call id;
- no permanent 400 loop;
- missing tool is reported as unavailable, not retained as a dead reference;
- the session can continue after a tool availability change.

## Recovery drill

Keep an offline copy of the transcript. If the session becomes poisoned, identify the exact durable reference that caused validation failure and document whether OpenCodex can reconcile it automatically.
