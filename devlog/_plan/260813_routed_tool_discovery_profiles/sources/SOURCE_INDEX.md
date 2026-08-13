# Source index

Verified on 2026-08-13 unless noted.

## OpenCodex

- Packaging-time `dev` head: https://github.com/lidge-jun/opencodex/commit/2cdbf66a23f9fd8f2f38dcc702ccd3f2e60ac535
- Tool-discovery base / PR #1596 merge: https://github.com/lidge-jun/opencodex/commit/5703473041a9f4f415743652de5d86d51fd66db5
- Issue #1522: https://github.com/lidge-jun/opencodex/issues/1522
- PR #1529: https://github.com/lidge-jun/opencodex/pull/1529
- PR #1596: https://github.com/lidge-jun/opencodex/pull/1596
- Current catalog parser: https://github.com/lidge-jun/opencodex/blob/dev/src/codex/catalog/parsing.ts
- Current catalog sync: https://github.com/lidge-jun/opencodex/blob/dev/src/codex/catalog/sync.ts
- Provider catalog hints: https://github.com/lidge-jun/opencodex/blob/dev/src/codex/catalog/provider-fetch.ts
- Combo aggregation: https://github.com/lidge-jun/opencodex/blob/dev/src/codex/catalog/aggregation.ts
- Config/type surfaces: https://github.com/lidge-jun/opencodex/blob/dev/src/config.ts and https://github.com/lidge-jun/opencodex/blob/dev/src/types.ts

## OpenAI Codex

- Code Mode globals: https://github.com/openai/codex/blob/main/codex-rs/code-mode-runtime/src/runtime/globals.rs
- Code Mode description/protocol: https://github.com/openai/codex/blob/main/codex-rs/code-mode-protocol/src/description.rs
- Code Mode tests: https://github.com/openai/codex/blob/main/codex-rs/core/tests/suite/code_mode.rs

## Comparator implementations

- CLIProxyAPI tool-search round trip: https://github.com/router-for-me/CLIProxyAPI/issues/3361
- CLIProxyAPI Responses Lite `additional_tools`: https://github.com/router-for-me/CLIProxyAPI/issues/4798
- LiteLLM MCP virtual search/call PR: https://github.com/BerriAI/litellm/pull/31777
- LiteLLM top-k issue: https://github.com/BerriAI/litellm/issues/33440
- Cloudflare Code Mode MCP: https://github.com/cloudflare/mcp

## Lifecycle/cache issue evidence

- Claude Code tool-array cache mutation: https://github.com/anthropics/claude-code/issues/81967
- Deferred acquisition reliability: https://github.com/anthropics/claude-code/issues/84312
- `tools/list_changed` stale index: https://github.com/anthropics/claude-code/issues/66084
- transient tool reference poisoning: https://github.com/anthropics/claude-code/issues/79970
- large ToolSearch batch cache rebuild: https://github.com/anthropics/claude-code/issues/83756

## Evidence policy

Comparator issue reports are used as design and test evidence, not as proof that OpenCodex has the identical defect. OpenCodex conclusions are scoped separately.
