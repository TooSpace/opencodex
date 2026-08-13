# 090 - Final recommendation

## Decision

Implement the route-scoped resolver first. Keep:

```text
non-Cursor -> code_mode_only + deferred
Cursor -> direct
```

Add provider/model direct overrides only for evidence-backed compatibility failures.

## Why

- PR #1596 established the lowest measured default among the tested shapes.
- Code Mode keeps nested tools locally available without full schema injection.
- #1522 still deserves a precise remediation path.
- One Boolean cannot represent catalog exposure, protocol conformance and model acquisition quality.

## PR order

1. resolver/config/tests/diagnostics;
2. adapter conformance fixtures;
3. exact live E2E certification;
4. bounded meta-tools where justified;
5. optional evidence-driven auto profile.

## What not to do

- do not restore blanket `supports_search_tool=false`;
- do not infer capability from model brand alone;
- do not silently drop unsupported tool kinds;
- do not dynamically mutate the top-level tool manifest without measuring cache impact;
- do not call an unmarked partial search result exhaustive.

## Immediate maintainer action

Review the field names and semantics in PR A, especially whether model-level `auto` means default re-evaluation or provider inheritance. Once fixed, implement the pure resolver and focused tests before touching protocol adapters.
