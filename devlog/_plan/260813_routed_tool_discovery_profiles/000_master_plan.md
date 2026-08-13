# 000 - Master plan: routed tool discovery profiles

Status: PLAN / PATCH-DRAFT / PROTOTYPE-VERIFIED / LANDED-AND-RE-VERIFIED
Created: 2026-08-13
Target repository: `lidge-jun/opencodex`
Target branch: `dev`
Packaging-time `dev` head: `2cdbf66a23f9fd8f2f38dcc702ccd3f2e60ac535`
Tool-discovery semantic base: `5703473041a9f4f415743652de5d86d51fd66db5` (PR #1596 parent of the packaging-time head)
Base change: PR #1596, `fix(codex): restore deferred tool discovery for non-Cursor routed rows`

> **Read `094_landing_verification_pass.md` before implementing anything.** This
> bundle was authored without a mounted checkout; every claim below was
> re-verified on 2026-08-13 against a real worktree, the upstream `codex-rs`
> source and live GitHub state. Eight corrections were recorded, the most
> consequential being that a source reading indicates an **eligible** MCP tool stays
> callable in **both** discovery modes under code mode — so for those tools `direct`
> reads as a comprehension/compatibility lever with a payload cost rather than a
> reachability fix. That conclusion is not yet backed by an executed single-variable
> differential; `020` still owes it and `029` records it as open.
> "Eligible" excludes `direct_only_tool_namespaces`, `excluded_tool_namespaces`,
> and anything removed by MCP/App policy filtering; see `094` for the exclusion
> table and the differential test that must prove the claim.

## 1. Objective

The immediate objective is to preserve the good part of PR #1596—small turn-1 payloads and Code Mode access through `exec`/`tools`/`ALL_TOOLS`—while adding a narrow, evidence-driven escape hatch for exact client/provider/model combinations where deferred discovery is proven unusable.

This plan does **not** revert non-Cursor routed rows to blanket `supports_search_tool: false`. That would recreate the measured full-catalog payload tax. It also does **not** claim that one catalog boolean can represent every tool lifecycle. The work is split into four layers:

1. **Catalog policy**: resolve whether a routed row advertises deferred discovery or direct discovery.
2. **Protocol conformance**: prove that `additional_tools`, custom tools, namespaces and tool-search history survive each adapter.
3. **Fallback architecture**: add bounded meta-tools for routes that cannot preserve native discovery.
4. **Live validation**: test exact Codex App + Browser plugin + external-model combinations.

## 2. Verified current state

At the verified `dev` head:

- `normalizeRoutedCatalogEntry()` lives in `src/codex/catalog/parsing.ts`.
- Every routed row receives `tool_mode = "code_mode_only"` through `applyRoutedCodexToolMode()`.
- Cursor rows receive `supports_search_tool = false` and no hosted web-search metadata.
- Every other routed row receives `supports_search_tool = true` and `web_search_tool_type = "text_and_image"`.
- The template-less fallback in `src/codex/catalog/sync.ts` reproduces the same Cursor/non-Cursor split.
- `tests/catalog-cursor-search.test.ts` pins the template and template-less paths.
- PR #1596 reports a measured request-size change of 96,699 → 258,929 characters when deferred discovery is disabled under Code Mode.
- PR #1596 also records a live canary where routed `kimi/k3` called `tools.mcp__node_repl__js` successfully.
- The exact #1522 pairing—Codex App + DeepSeek-compatible routed model + Browser plugin—remains the material evidence gap.

## 3. Recommended PR stack

### PR A — profile resolver and explicit escape hatch

Default behavior is intended to be equivalent to #1596, and is asserted per-key on both
construction paths rather than by a normalized diff against a real prior build (that
comparison is still open — see `029`):

- non-Cursor: deferred
- Cursor: direct

New provider-level and model-level settings allow a proven-bad route to opt into direct discovery without changing unrelated routes.

Suggested fields:

```ts
export type OcxRoutedToolDiscoveryMode = "auto" | "deferred" | "direct";

interface OcxProviderConfig {
  routedToolDiscovery?: OcxRoutedToolDiscoveryMode;
  modelRoutedToolDiscovery?: Record<string, OcxRoutedToolDiscoveryMode>;
}
```

Resolution precedence:

```text
Cursor hard fence
  > exact model override
  > provider override
  > auto default
```

`auto` resolves to `deferred` for non-Cursor and `direct` for Cursor.

### PR B — Responses tool conformance

Build fixture-driven tests for:

- top-level `tools`
- `input[].type == "additional_tools"`
- function/custom/namespace conversion
- tool-search call/output history
- streaming and non-streaming output
- continuation, compaction and resume

No route may claim native discovery unless this matrix passes for its active adapter.

### PR C — bounded meta-tool fallback

Introduce a sidecar/multiplexer surface:

```text
ocx_tool_search
ocx_tool_describe
ocx_tool_call
```

This is the long-term fallback for incompatible routes. It avoids both silent tool loss and full eager schemas.

### PR D — exact live E2E and rollout telemetry

Automate or manually certify the #1522 pairing and representative variants. Record payload size, discovery path, actual tool call, adapter, client surface and model.

## 4. Files in this unit

### Research and decisions

- `001_verified_dev_baseline.md`
- `002_incident_history_1522_1529_1596.md`
- `003_current_code_map.md`
- `004_upstream_codex_code_mode.md`
- `005_comparator_findings.md`
- `006_architecture_invariants.md`
- `007_scenario_matrix.md`
- `008_risk_register.md`
- `009_open_questions_and_evidence_gaps.md`
- `094_landing_verification_pass.md` — worktree/upstream/GitHub re-verification

### Implementation roadmap

- `010_phase1_profile_resolver.md`
- `011_phase1_types_and_config.md`
- `012_phase1_catalog_patch.md`
- `013_phase1_sync_and_fingerprint.md`
- `014_phase1_diagnostics.md`
- `020_phase2_unit_tests.md`
- `021_catalog_test_cases.md`
- `022_config_and_precedence_tests.md`
- `023_backward_compatibility_tests.md`
- `030_phase3_protocol_conformance.md`
- `031_responses_lite_additional_tools.md`
- `032_custom_namespace_roundtrip.md`
- `033_tool_search_history_and_compaction.md`
- `040_phase4_live_e2e.md`
- `041_code_mode_all_tools_canary.md`
- `042_codex_app_deepseek_browser.md`
- `043_cursor_and_direct_bounded.md`
- `044_weak_model_meta_tool_fallback.md`
- `050_phase5_payload_cache_benchmarks.md`
- `051_benchmark_methodology.md`
- `052_acceptance_thresholds.md`
- `060_phase6_meta_tool_design.md`
- `061_meta_tool_contract.md`
- `062_meta_tool_security.md`
- `070_rollout_plan.md`
- `071_observability.md`
- `072_canary_matrix.md`
- `080_rollback_plan.md`
- `081_failure_triage_runbook.md`
- `090_final_recommendation.md`
- `091_pr_stack_and_commits.md`
- `092_definition_of_done.md`

### Executable supplements

- `prototype/mvp-resolver.mjs`
- `prototype/profile-resolver.mjs`
- `prototype/tool-discovery-profile.test.mjs`
- `prototype/payload-benchmark.mjs`
- `patches/0001-routed-tool-discovery-profile.patch`
- `patches/0002-focused-tests.patch`
- `scripts/run_repo_validation.sh`
- `results/prototype-test-output.txt`
- `results/payload-benchmark.json`

## 5. Decision summary

The first code change should be a **small resolver and override**, not the full meta-tool system. It gives operators a safe emergency lever while preserving the current default. The full fallback belongs in a separate PR because it adds a new execution surface, security boundary and search-quality problem.

The minimum acceptable outcome is:

- zero default behavior change from PR #1596;
- explicit direct override only for a named provider/model;
- exact unit coverage for precedence and fallback catalog paths;
- payload warning for direct mode;
- no claim of universal native tool-search support until adapter conformance passes.
