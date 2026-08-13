# Executed benchmark summary

The included benchmark generated synthetic MCP functions with nested schemas and compared UTF-8
payload structures. This is a structural scaling test, not a tokenizer or live Codex request capture.

| Tools | Eager full schemas | Code Mode name/description index | Fixed meta-tools |
|---:|---:|---:|---:|
| 250 | 179,218 B | 52,393 B | 744 B |
| 1,000 | 716,969 B | 209,894 B | 744 B |

At 250 tools, eager full declarations were 3.421× the name/description index. At 1,000 tools,
the per-tool sizes remained approximately linear while the fixed meta-tool declaration stayed
constant.

Raw outputs:

- `payload-benchmark-250.json`
- `payload-benchmark-1000.json`
