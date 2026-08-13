# 072 - Canary matrix

| Client | Adapter | Model family | Plugin/MCP | Profile | Cadence |
|---|---|---|---|---|---|
| Codex CLI | openai-chat | Kimi | canary MCP | Code Mode | every release |
| Codex App | openai-chat | DeepSeek | Browser | Code Mode | every App/CLI change |
| Codex App | openai-chat | DeepSeek | Browser | direct override | control arm |
| Codex CLI | anthropic | Claude-compatible | canary MCP | Code Mode | every translator change |
| Codex CLI | Responses Lite bridge | GLM | exec/custom | native/conformance | every bridge change |
| Codex App | Cursor | Browser | direct | every Cursor transport change |
| Codex CLI | weak model set | synthetic catalog | meta-tools | candidate releases |

## Sentinel rules

Use harmless, deterministic operations and unique sentinels. A canary passes only when the external tool produces the sentinel; model text alone is insufficient.

## Evidence expiry

Expire certification when any scoped component changes materially:

- client minor version/tool runtime;
- adapter implementation;
- upstream protocol version;
- meta-tool contract;
- model family behavior if acquisition-dependent.
