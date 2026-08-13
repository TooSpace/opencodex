# 008 - Risk register

| Risk | Likelihood | Impact | Detection | Mitigation |
|---|---:|---:|---|---|
| Direct override recreates large payloads | High when used | High cost/latency | request-size telemetry | warn, bound, scope to exact model |
| Resolver defaults accidentally change #1596 | Medium | High regression | snapshot/unit tests | explicit auto-default tests |
| Cursor forced into deferred path | Low | High functional loss | Cursor catalog tests | hard fence in resolver |
| Config typo invalidates entire file | Medium | High data loss | config user-edit tests | load sanitizer + strict write boundary |
| Catalog gather reuses stale policy | Medium | Medium | concurrency/fingerprint test | include policy in gather identity |
| Model override key fails date/alias matching | Medium | Medium | modelRecordValue fixtures | reuse existing helper |
| Combo derives conflicting member modes | Medium | Medium | combo tests | conservative intersection: direct wins |
| Responses Lite drops `additional_tools` | Known class | High silent failure | request translation fixtures | merge both tool sources |
| Tool type restored as wrong event | Medium | High agent-loop failure | streaming/non-streaming fixtures | preserve original type map |
| Deferred tool not acquired by weak model | Medium | Medium | A/B acquisition eval | meta-tools or direct override |
| Tool list changes invalidate cache | Medium | High cost | manifest hash telemetry | stable top-level manifest |
| Search index stale after list change | Medium | Medium | dynamic MCP E2E | refresh side index |
| Transient tool poisons resume | Low/Medium | High | resume fixture | filter/reconcile durable references |
| Meta-tool search misses correct tool | Medium | Medium | recall benchmark | exact match, top-k≥10, pagination |
| Meta-tool call bypasses permissions | Low if designed poorly | Critical | security tests | reuse normal authorization path |
| Huge tool result bloats active context | High over long sessions | Medium | result-byte metrics | result caps and compact references |

## Stop-ship conditions

- default non-Cursor row no longer resolves deferred;
- Cursor row advertises deferred or hosted search;
- direct override leaks to sibling providers/models;
- invalid optional config resets providers or API keys;
- translator returns success after deleting all tools;
- meta-tool call can invoke an unauthorized server/tool;
- full suite introduces unexplained catalog snapshot churn.
