# 015 - Phase 1 review checklist

## Scope

- [ ] Only route policy, config, catalog propagation, tests and docs.
- [ ] No adapter behavior change.
- [ ] No MCP execution path change.
- [ ] No new network request.

## Correctness

- [ ] Non-Cursor default remains deferred.
- [ ] Cursor remains direct under every override.
- [ ] Model override wins provider override.
- [ ] `auto` is resolved before serialization.
- [ ] Hosted web-search metadata remains independent.
- [ ] Combo direct member forces direct combo row.
- [ ] Template and fallback paths share one policy.

## Config safety

- [ ] Invalid hand edit does not reset providers or API keys.
- [ ] Live write rejects invalid values.
- [ ] Prototype-polluted maps fail closed.
- [ ] Display/diagnostic surfaces redact provider/model keys when needed.

## Cache safety

- [ ] Policy fields participate in gather identity.
- [ ] Changing an override invalidates relevant catalog cache.
- [ ] Unrelated rows do not churn.

## Tests

- [ ] typecheck.
- [ ] focused catalog tests.
- [ ] config load/write tests.
- [ ] combo tests.
- [ ] full suite.
- [ ] privacy scan.
