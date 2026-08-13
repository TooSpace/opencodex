# 091 - Proposed PR stack and commits

## PR A — route policy

Title:

```text
feat(codex): add routed tool-discovery compatibility profiles
```

Commits:

1. `feat(config): add routed tool discovery overrides`
2. `refactor(catalog): resolve discovery mode through provider hints`
3. `test(codex): cover discovery precedence, Cursor fence and combos`
4. `docs(codex): document route-scoped direct fallback`

## PR B — conformance

Title:

```text
fix(responses): preserve complete tool discovery round trips
```

Commits organized by declaration, history, streaming and compaction fixtures.

## PR C — meta-tools

Title:

```text
feat(mcp): add bounded search, describe and call fallback
```

Security review required.

## PR D — live evidence and auto selection

Title:

```text
feat(codex): select tool profile from versioned compatibility evidence
```

Do not open until exact live matrix is complete.

## Branch discipline

Each PR starts from the then-current `dev`, remains independently reviewable and does not mix GUI cleanup or unrelated adapter changes.
