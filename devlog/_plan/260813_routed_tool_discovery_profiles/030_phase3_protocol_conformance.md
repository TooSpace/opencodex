# 030 - Phase 3: protocol conformance programme

Status: SEPARATE PR STACK

## Objective

Determine whether each adapter can support native tool discovery rather than inferring capability from a model name or provider label.

## Conformance identity

Every result must be scoped by:

```text
client surface + client version + adapter + upstream protocol + OpenCodex version
```

Example:

```text
codex-app/26.803.61601
openai-responses -> anthropic translator
opencodex/2.13.x
```

## Required dimensions

- request tool declaration;
- model tool call;
- tool result replay;
- next-turn activation;
- streaming/non-streaming;
- continuation;
- compaction;
- resume;
- namespace and custom type preservation;
- transient tool handling.

## Result states

```text
UNPROBED -> PROBED -> VERIFIED
                 \-> DEGRADED
                 \-> FAILED
```

No automatic profile selection should depend on less than VERIFIED evidence.

## Artifact output

Each suite writes a machine-readable JSON result and a human-readable MD report. The JSON includes fixture hash, versions, pass counts, failure stage and expiry timestamp.
