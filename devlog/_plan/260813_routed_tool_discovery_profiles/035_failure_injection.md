# 035 - Protocol failure injection

## Injected failures

1. translator drops `additional_tools`;
2. translator maps custom to function;
3. namespace map missing on replay;
4. tool-search output omitted on next turn;
5. duplicate call id;
6. tool result arrives before declaration;
7. transient reference disappears;
8. compaction removes loaded schema;
9. upstream returns ordinary text instead of tool call;
10. SSE closes after call start.

## Required behavior

OpenCodex must distinguish:

- model chose not to use a tool;
- route could not advertise the tool;
- translator deleted the tool;
- protocol call failed;
- tool execution failed.

Only the first is a normal model completion. The others require explicit diagnostics or fallback.

## Fail-closed rule

If the route has deferred declarations but no usable discovery mechanism, select a safer profile before sending the request. Do not forward an internally inconsistent request and hope the model compensates.
