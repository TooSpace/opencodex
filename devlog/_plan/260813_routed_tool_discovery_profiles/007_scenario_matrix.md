# 007 - Scenario matrix

| ID | Surface | Provider/adapter | Tool path | Expected profile | Required proof |
|---|---|---|---|---|---|
| S01 | Codex CLI | non-Cursor routed | Code Mode `tools`/`ALL_TOOLS` | deferred | tool exists, model calls it, payload bounded |
| S02 | Codex App | DeepSeek-compatible routed + Browser plugin | Code Mode plugin tool | deferred if passing; direct override if failing | exact #1522 reproduction |
| S03 | Codex App | Kimi routed + Browser/plugin | Code Mode plugin tool | deferred | live canary parity with App surface |
| S04 | Codex CLI/App | Cursor | custom runTurn transport | direct | no false hosted/deferred advertisement |
| S05 | Responses Lite | Anthropic translator | `additional_tools` | native/conformant | function/custom/namespace retained |
| S06 | Chat Completions bridge | generic external model | flattened functions | meta-tools or direct bounded | no silent type loss |
| S07 | weak external model | many MCP tools | Code Mode | deferred or meta-tools | acquisition-rate A/B test |
| S08 | dynamic MCP server | `tools/list_changed` | local index refresh | deferred/meta-tools | new tool callable without restart |
| S09 | compaction/resume | any routed model | restored history | same profile | no dangling references; tool callable |
| S10 | transient startup tool | any surface | early discovery | filtered | no persisted dead reference |
| S11 | 500+ tools | any non-Cursor Code Mode | deferred | deferred | turn-1 payload sublinear in schema bytes |
| S12 | explicit provider direct override | named route | eager/direct | direct | only target provider changes |
| S13 | explicit model direct override | mixed gateway | eager/direct | direct for one model | sibling stays deferred |
| S14 | invalid config value | config load/write | n/a | degrade on load; reject write | no provider loss |
| S15 | provider config changes mid-flight | catalog gather | cache identity | new result | no stale shared promise |
| S16 | meta-tool search | 100+ similar names | bounded search | meta-tools | exact/prefix/BM25 recall and pagination |
| S17 | meta-tool call collision | same short name in namespaces | qualified call | meta-tools | no wrong namespace fallback |
| S18 | hosted web search + direct MCP | non-Cursor | independent surfaces | direct + hosted search | both available independently |

## Priority

### P0

S01, S02, S04, S05, S09, S11, S12, S13, S14.

### P1

S07, S08, S10, S15, S18.

### P2

S16 and S17 belong to the meta-tool PR, not the initial resolver PR.
