# 004 - Upstream Codex Code Mode findings

> **Amended 2026-08-13** against the upstream source on disk
> (`/Users/jun/Developer/codex/120_codex-cli`, `main` @ `4462b9dee`, 2026-07-23).
> See `094_landing_verification_pass.md` Correction 2. The mechanism described
> below is confirmed, but its consequence was understated: under
> `tool_mode = code_mode_only`, an **eligible** MCP tool is installed on the V8
> `tools` / `ALL_TOOLS` globals in **both** deferred and direct mode. For such a
> tool the flag changes where the schemas live, not whether it is callable.
> "Eligible" excludes `direct_only_tool_namespaces`, `excluded_tool_namespaces`,
> and anything removed by MCP/App visibility or policy filtering — see the
> exclusion table in `094`.

## Verified mechanism

OpenAI Codex's Code Mode runtime installs:

- `tools`: callable functions for enabled nested tools;
- `ALL_TOOLS`: `{name, description}` metadata for enabled nested tools;
- helpers such as `text`, `image`, `store`, `load`, `yield_control` and `exit`.

The public `exec` description states that nested tools are available through the global `tools` object and listed in `ALL_TOOLS`. When some nested tools are deferred, the description tells the model that omitted tools still exist in those globals.

Relevant upstream files:

- `codex-rs/code-mode/src/runtime/globals.rs`
- `codex-rs/code-mode-protocol/src/description.rs`
- `codex-rs/core/tests/suite/code_mode.rs`
- `codex-rs/core/src/tools/spec_plan.rs`
- `codex-rs/core/src/tools/spec_plan_tests.rs`

Path note (2026-08-13): the runtime crate is `codex-rs/code-mode/`, not
`code-mode-runtime/`. The load-bearing exposure and executor logic lives in
`spec_plan.rs`; `spec_plan_tests.rs` also exists and was correctly named in the
original list. Verified in the checkout at `4462b9dee`.

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
   That is the measured 96,699 → 258,929 character regression. For an eligible
   tool the schema placement is the material difference — it stays equally
   callable either way.

The flag additionally drives `tool_search` construction and the deferred-guidance
text, and it does **not** govern three independent removal paths
(`direct_only_tool_namespaces` → `DirectModelOnly`, `excluded_tool_namespaces`,
and pre-classification MCP/App policy filtering). An override cannot repair any of
those.

The isolate is built for `ToolMode::CodeMode` as well as `CodeModeOnly`
(`spec_plan.rs:459`), so the reachability reasoning covers both; `code_mode_only`
additionally hides ordinary nested tools from the top-level list. Only under
`ToolMode::Direct` is there no isolate, and there the flag does govern direct
declaration versus `tool_search`. Every routed OpenCodex row is stamped
`code_mode_only` today.

So for eligible tools under code mode the `direct` override is a
model-comprehension lever (full schemas inline rather than via `ALL_TOOLS`) with a
payload cost, not a reachability fix. E1/E2 in `009` remain open: this reading
comes from a 2026-07-23 clone, while #1522 reported against CLI
`0.147.0-alpha.6.5` on 2026-08-12, and app-layer gating outside this clone is
unverified. `020`/`021` owe a controlled single-variable test before this claim is
treated as settled.

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
