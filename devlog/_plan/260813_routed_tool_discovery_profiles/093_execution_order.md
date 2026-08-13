# 093 - Suggested execution order

```text
Day/PR 1
  resolver module
  config fields and validation
  provider-hint propagation
  template/fallback/combo serialization
  focused tests

Day/PR 2
  Responses Lite fixtures
  custom/namespace history
  streaming parity
  explicit failure diagnostics

Lab run
  CLI canary
  App canary
  #1522 exact A/B
  payload/cache captures

PR 3 if required
  meta-tool registry
  search/describe/call
  security and authorization tests

Later
  evidence store
  automatic profile selection
```

The sequence is risk-ordered: first add control without changing defaults, then prove the protocol, then add a new execution surface only when evidence justifies it.
