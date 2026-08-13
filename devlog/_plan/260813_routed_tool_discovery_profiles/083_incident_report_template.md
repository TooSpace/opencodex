# 083 - Incident report template

```markdown
# Routed tool incident

Date/time:
OpenCodex commit/version:
Client surface/version:
Provider/adapter/base URL class:
Model id:
Plugin/MCP server:
Resolved discovery mode/profile/source:

## Expected

## Actual

## Minimal prompt

## Tool lifecycle
- declared by client:
- parsed by OpenCodex:
- sent upstream:
- model call received:
- restored call type/name/namespace:
- executed:
- output replayed:
- final response:

## Metrics
- top-level tools:
- indexed/nested tools:
- declaration bytes:
- total request bytes:
- manifest hash changes:
- cache read/write:

## A/B result
- deferred:
- direct:
- meta-tools:

## Redaction statement

## Proposed disposition
```
