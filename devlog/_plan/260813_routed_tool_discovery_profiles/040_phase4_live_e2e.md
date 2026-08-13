# 040 - Phase 4: live E2E programme

Status: REQUIRES REAL CODEX CLIENTS AND CREDENTIALS

## Purpose

Unit tests prove serialization. Live E2E proves the client constructs the expected Code Mode registry and the selected model actually acquires and calls the tool.

## Capture bundle per run

```text
run.json                 # versions, profile, result
catalog-row.json         # redacted selected model entry
request-metrics.json     # counts/bytes/hashes, no prompt or credentials
all-tools.txt            # names and bounded descriptions
transcript.redacted.jsonl
client.log
proxy.log
```

## Success definition

- requested capability is reachable;
- model calls it without the user naming an internal function when testing discoverability;
- output is returned to the model;
- final answer uses the result;
- request size stays inside threshold;
- no silent fallback to a different model/provider.

## Test hygiene

Use a fresh task/session for every arm. Keep prompt, plugin set, model effort and repository constant. Record absolute versions and timestamps.
