# 004 - Upstream Codex Code Mode findings

> **Amended 2026-08-13** against the upstream source on disk
> (`/Users/jun/Developer/codex/120_codex-cli`, `main` @ `4462b9dee`, 2026-07-23).
> See `094_landing_verification_pass.md` Correction 2. The mechanism described
> below is confirmed, but its consequence was understated: under
> `tool_mode = code_mode_only`, MCP tools are installed on the V8 `tools` /
> `ALL_TOOLS` globals in **both** deferred and direct mode. The flag changes
> where the schemas live, not whether the tools are callable.

## Verified mechanism

OpenAI Codex's Code Mode runtime installs:

- `tools`: callable functions for enabled nested tools;
- `ALL_TOOLS`: `{name, description}` metadata for enabled nested tools;
- helpers such as `text`, `image`, `store`, `load`, `yield_control` and `exit`.

The public `exec` description states that nested tools are available through the global `tools` object and listed in `ALL_TOOLS`. When some nested tools are deferred, the description tells the model that omitted tools still exist in those globals.

Relevant upstream files:

- `codex-rs/code-mode-runtime/src/runtime/globals.rs`
- `codex-rs/code-mode-protocol/src/description.rs`
- `codex-rs/core/tests/suite/code_mode.rs`
- `codex-rs/core/src/tools/spec_plan_tests.rs`

Repository: https://github.com/openai/codex

## The exposure switch, verbatim

```rust
let exposure = if search_tool_enabled { ToolExposure::Deferred } else { ToolExposure::Direct };
```

`codex-rs/core/src/mcp_tool_exposure.rs:35`, where

```rust
pub(crate) fn search_tool_enabled(turn_context: &TurnContext) -> bool {
    turn_context.model_info.supports_search_tool && namespace_tools_enabled(turn_context)
}
```

`codex-rs/core/src/tools/spec_plan.rs:330`.

Two consequences:

1. `supports_search_tool` is not the sole switch — a provider without Responses
   namespace tools resolves to `Direct` whatever the catalog says.
2. `Direct` under code mode means every MCP declaration is embedded in
   `exec.description` (they enter `enabled_tools` instead of `deferred_tools`).
   That is the measured 96,699 → 258,929 character regression, and it is the
   *only* material difference — the tools are equally callable either way.

So the `direct` override is a model-comprehension lever (full schemas inline
rather than via `ALL_TOOLS`) with a payload cost. It is **not** a reachability fix
under code mode. E1/E2 in `009` remain open: this reading comes from a 2026-07-23
clone, while #1522 reported against CLI `0.147.0-alpha.6.5` on 2026-08-12, and
app-layer gating outside this clone is unverified.

## Architectural implication

For a non-Cursor routed model running under Codex Code Mode, provider-native `tool_search` is not the only reachability path. The client-side isolate can expose tools independently of whether the upstream provider knows anything about MCP.

Therefore:

```text
supports_search_tool=true
+ tool_mode=code_mode_only
```

is a client-harness profile, not a claim that Kimi, DeepSeek or Claude hosts implement OpenAI tool search.

## What this mechanism does not prove

It does not prove:

- every external model will choose `exec` reliably;
- Codex App and CLI have identical plugin initialization timing;
- Browser plugin namespaces always enter the Code Mode runtime;
- dynamic `tools/list_changed` updates refresh the active isolate;
- compaction and resume preserve the same tool roster;
- a weak model can discover a semantically relevant tool from `ALL_TOOLS`.

## Test consequence

Tests must distinguish:

1. **mechanical availability**: the function exists on `tools`;
2. **catalog discoverability**: metadata appears in `ALL_TOOLS`;
3. **model acquisition**: the model actually selects the function;
4. **round-trip execution**: Codex executes it and sends the result back;
5. **lifecycle durability**: the same remains true after changes, compaction and resume.
