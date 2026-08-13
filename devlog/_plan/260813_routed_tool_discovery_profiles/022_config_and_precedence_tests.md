# 022 - Config and precedence tests

## Valid candidates

```json
{ "routedToolDiscovery": "auto" }
{ "routedToolDiscovery": "deferred" }
{ "routedToolDiscovery": "direct" }
{ "modelRoutedToolDiscovery": { "glm-5.2": "direct" } }
```

## Invalid live writes

Reject:

```json
{ "routedToolDiscovery": "eager" }
{ "modelRoutedToolDiscovery": [] }
{ "modelRoutedToolDiscovery": { "": "direct" } }
{ "modelRoutedToolDiscovery": { "glm-5.2": false } }
```

## Hand-edited load recovery

A malformed optional field should be ignored while preserving:

- provider adapter and base URL;
- API key pool;
- default provider;
- port and hostname;
- all unrelated providers.

Test both the raw diagnostics path and load→mutate→save round trip.

## Precedence fixture

Use one provider with three models:

```json
{
  "routedToolDiscovery": "direct",
  "modelRoutedToolDiscovery": {
    "a": "deferred",
    "b": "auto"
  }
}
```

Expected:

| Model | Result |
|---|---|
| a | deferred |
| b | deferred (`auto` default) |
| c | direct (provider) |

## Security fixture

Construct a null-prototype map and explicit own `__proto__` key. Validation must not permit prototype pollution or silently rewrite the target model set.
