# 052 - Initial acceptance thresholds

## Default deferred profile

- first-request declaration growth should be dominated by names/descriptions, not full schemas;
- 500 tools must not force all JSON Schemas into `exec.description`;
- a simple canary must remain callable.

## Direct override

Warning threshold proposal:

```text
>100 tools OR >128 KiB schema bytes OR >256 KiB request body
```

Stop-ship threshold for an unbounded default:

```text
Any zero-config change that makes request size proportional to full MCP schema bytes
```

## Meta-tools

- always-visible declaration budget below 4 KiB;
- search default at least 10 results;
- exact qualified-name recall 100%;
- pagination signal required for incomplete results;
- describe maximum 3 schemas/call by default.

## Acquisition

For target models, deferred/meta profile should achieve at least 95% of loaded-tool success on deterministic tasks, or materially outperform direct mode on cost without unacceptable correctness loss.

Thresholds are provisional until live data is collected.
