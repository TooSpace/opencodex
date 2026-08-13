# 051 - Benchmark methodology and recorded synthetic result

## Command

```bash
node prototype/payload-benchmark.mjs 250
node prototype/payload-benchmark.mjs 1000
```

## 250-tool result

| Shape | UTF-8 bytes |
|---|---:|
| eager full schemas | 179,218 |
| Code Mode names + descriptions | 52,393 |
| three fixed meta-tools | 744 |

Ratios:

- eager / Code Mode index: 3.421×;
- eager / meta-tools: 240.884×.

## 1,000-tool result

| Shape | UTF-8 bytes |
|---|---:|
| eager full schemas | 716,969 |
| Code Mode names + descriptions | 209,894 |
| three fixed meta-tools | 744 |

## Interpretation limits

These figures demonstrate scaling shape only. They do not reproduce:

- Codex's complete instructions;
- actual plugin descriptions;
- OpenAI tokenizer behavior;
- prompt compression/caching;
- the exact #1596 measurement harness.

Use the included JSON files as a local sanity check, then replace them with live fixed-harness captures before making product thresholds.
