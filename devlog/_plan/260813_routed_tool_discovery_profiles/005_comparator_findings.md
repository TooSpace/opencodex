# 005 - Comparator findings

## CLIProxyAPI

Useful evidence:

- Responses Lite may put tools in `input[].type == "additional_tools"` instead of top-level `tools`.
- A translator that reads only top-level tools can silently erase terminal, custom and namespace tools.
- The model may then emit ordinary text such as “I will run it” and complete normally, making the failure look like model behavior rather than protocol loss.
- Full round-trip support requires request conversion, history replay, response restoration, stable call IDs and namespace preservation.

Relevant issues:

- https://github.com/router-for-me/CLIProxyAPI/issues/4798
- https://github.com/router-for-me/CLIProxyAPI/issues/3361

## LiteLLM

LiteLLM added two virtual tools for large MCP catalogs:

```text
mcp_tool_search
mcp_tool_call
```

This bounds the always-visible schema surface, but its simple token-overlap search and default `top_k=5` can miss the correct tool. A reported 113-tool test observed recall 0.70 at 5 and 1.00 at 10.

Relevant items:

- https://github.com/BerriAI/litellm/pull/31777
- https://github.com/BerriAI/litellm/issues/33440

## Cloudflare Code Mode

Cloudflare exposes a huge API through three general tools (`docs`, `search`, `execute`) and keeps the full specification server-side. Its published comparison shows the central advantage: tool count becomes approximately constant in the model context.

Repository:

- https://github.com/cloudflare/mcp

## cc-switch

cc-switch's useful principle is capability bundling by verified host/protocol profile rather than model brand alone. Its limitation is that conservative templates can still disable discovery broadly. OpenCodex should adopt the profile idea but retain Code Mode-aware defaults.

Repository:

- https://github.com/farion1231/cc-switch

## Claude Code public issue evidence

Deferred loading introduces lifecycle risks:

- tool-array mutation can invalidate large prompt-cache prefixes;
- a model may under-use deferred capabilities;
- dynamic tool-list updates can leave a stale search index;
- transient tool references can poison resumed sessions;
- large search batches can trigger expensive cache rebuilds.

Representative issues:

- https://github.com/anthropics/claude-code/issues/81967
- https://github.com/anthropics/claude-code/issues/84312
- https://github.com/anthropics/claude-code/issues/66084
- https://github.com/anthropics/claude-code/issues/79970
- https://github.com/anthropics/claude-code/issues/83756

## Composite conclusion

No comparator provides a complete drop-in answer. The strongest composite is:

```text
Codex local Code Mode by default
+ route-specific conformance evidence
+ bounded meta-tool fallback
+ stable session manifest
+ exact live E2E certification
```
