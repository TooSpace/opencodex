# 094 - Landing verification pass

Status: VERIFIED IN A REAL WORKTREE
Date: 2026-08-13
Worktree: `/Users/jun/.codex/worktrees/9d46/opencodex`
Worktree HEAD at landing: `1849b947b32f9d909e06552582a63b6842db246b`
`origin/dev` at landing: `2cdbf66a23f9fd8f2f38dcc702ccd3f2e60ac535`

## Why this document exists

`001_verified_dev_baseline.md` closes with an honest admission:

> This bundle was built without a mounted full repository checkout.

Every "verified" claim in documents `001`–`013` was therefore verified against
GitHub file reads, not against a working tree, a compiler, or the upstream Rust
client. This pass re-checks the load-bearing claims with the repository actually
mounted, the upstream `codex-rs` source on disk, and authenticated GitHub access.

The result: the plan's **architecture is sound and its default-preserving stance
is correct**, but six specific claims are wrong or incomplete in ways that would
have produced a broken or under-scoped first PR. Corrections are recorded here
and applied in place to the affected documents.

## Verification sources

| Lane | Source | Scope |
|---|---|---|
| Upstream semantics | `/Users/jun/Developer/codex/120_codex-cli`, `main` @ `4462b9deef211723b781b426f5e5d36a5777115f` (2026-07-23) | What `supports_search_tool` actually does in the client |
| Repository history | authenticated `gh`, `origin/dev` @ `2cdbf66a2` | #1522 / #1529 / #1596 / #1587, open-PR collisions, CI gates |
| Code seams | this worktree, `rg` + numbered reads | every file the first PR must touch |

## Confirmed claims

These bundle statements survived contact with the real tree unchanged:

- `normalizeRoutedCatalogEntry()` lives in `src/codex/catalog/parsing.ts` and
  stamps `tool_mode = code_mode_only`, Cursor `supports_search_tool = false`,
  non-Cursor `true`. Verified at `parsing.ts:381-418`.
- `src/codex/catalog/sync.ts` carries an independent template-less fallback that
  duplicates the same policy. Verified at `sync.ts:312-343`.
- `applyProviderConfigHints()` is the right resolver call site: it already
  resolves context windows, modalities, max input tokens, reasoning ladders,
  summary support and `parallelToolCalls`. Verified at `provider-fetch.ts:610-658`.
- `providerCatalogFingerprint()` is an explicit allow-list and would silently omit
  a new field. Verified at `provider-fetch.ts:536-559`.
- No commit on `origin/dev` after #1596 (`5703473041a9f4f415743652de5d86d51fd66db5`)
  has touched `parsing.ts`, `sync.ts`, `config.ts` or `types.ts`. The semantic base
  the plan targets is still the live head's behavior.
- Hosted web search really is a separate capability upstream: `web_search_tool_type`
  feeds only the hosted tool's content types, and hosted availability is a distinct
  provider capability. INV-3 is correct.

## Correction 1 — `supports_search_tool` is gated by a second condition

The plan treats the flag as the sole switch for deferred discovery. Upstream it is
one of two conjuncts:

```rust
pub(crate) fn search_tool_enabled(turn_context: &TurnContext) -> bool {
    turn_context.model_info.supports_search_tool && namespace_tools_enabled(turn_context)
}
```

`codex-rs/core/src/tools/spec_plan.rs:330`.

A route whose provider does not support Responses namespace tools resolves to
`Direct` MCP exposure **regardless of what the catalog advertises**. That has two
consequences the plan must absorb:

- `direct` mode is sometimes already in effect without any override, so an
  operator's "it did not work" report is not automatically evidence that the
  catalog flag is wrong.
- The diagnostic in `014` must not claim the resolved catalog mode is the
  effective runtime mode. It can only report what OpenCodex advertises.

## Correction 2 — under `code_mode_only`, an *eligible* MCP tool stays reachable in BOTH modes

This is the most important correction, and it strengthens the plan's default.

**Scope, stated first.** This correction holds for an **ordinary eligible MCP
tool** — one that already survived MCP/App visibility and policy filtering, is not
in `direct_only_tool_namespaces`, and is not in `excluded_tool_namespaces`. It is
not an unconditional statement about every tool on every surface. The exclusions
are enumerated below and each is independent of `supports_search_tool`.

`004` implies deferred discovery is what keeps tools reachable. In fact, under
`ToolMode::CodeModeOnly` the nested tool specs are handed to the `exec` handler
and installed as V8 globals in either mode:

```rust
set_global(scope, global, "tools", tools.into())?;
set_global(scope, global, "ALL_TOOLS", all_tools)?;
```

`codex-rs/code-mode/src/runtime/globals.rs:15`, fed from
`spec_plan.rs:463` → `execute_handler.rs:29` → `runtime/mod.rs:89`.

The exposure switch changes classification, not reachability:

```rust
let exposure = if search_tool_enabled { ToolExposure::Deferred } else { ToolExposure::Direct };
```

`codex-rs/core/src/mcp_tool_exposure.rs:35`.

With `supports_search_tool = false`, the tools' **full declarations** move into
`exec.description` because they enter `enabled_tools` rather than `deferred_tools`.
That is precisely the 96,699 → 258,929 character regression #1596 measured. So for
an eligible tool the `direct` escape hatch buys **no additional callability under
code mode** — it buys schema text inside `exec.description`.

Confirmed by the upstream suite from both directions: a direct-exposure MCP tool
reaches the globals (`core/tests/suite/code_mode.rs:3248`), and a deferred one does
too (`core/tests/suite/code_mode.rs:644`).

### What else the flag changes, and what it never controls

Schema placement is the main difference but not the only one. Deferred exposure
also drives `tool_search` construction and the deferred-tool guidance text
(`spec_plan.rs:932`, `description.rs:10`).

And three mechanisms remove a tool from the Code Mode globals **independently of
this flag** — an override cannot fix any of them, and a reporter hitting one will
look like a discovery failure:

| Mechanism | Effect | Citation |
|---|---|---|
| `direct_only_tool_namespaces` | exposure becomes `DirectModelOnly`; the namespace stays top-level and is **excluded from Code Mode** | `spec_plan.rs:210` |
| `excluded_tool_namespaces` | nested tools removed outright | `spec_plan.rs:444` |
| MCP/App visibility and policy filtering | applied *before* exposure classification, so a filtered tool never reaches either path | `mcp_tool_exposure.rs:20` |

The isolate is not exclusive to `code_mode_only`. `build_code_mode_executors()`
returns early only when the mode is neither:

```rust
if !matches!(tool_mode, ToolMode::CodeMode | ToolMode::CodeModeOnly) {
    return vec![];
}
```

`spec_plan.rs:459`. So plain `ToolMode::CodeMode` also builds the `tools`/
`ALL_TOOLS` globals, and the reachability reasoning holds there too; what
`code_mode_only` adds is hiding ordinary nested tools from the **top-level** tool
list. Only under `ToolMode::Direct` is there no isolate — and there
`supports_search_tool` genuinely governs whether MCP tools are declared directly
or must be found through `tool_search`. OpenCodex stamps every routed row
`code_mode_only`, so `Direct` is not a routed-row concern today, but the
distinction matters if that stamp is ever relaxed.

### Required before the claim is load-bearing

`020`/`021` must add one controlled test that toggles **only**
`supports_search_tool` under otherwise identical `code_mode_only` conditions and
asserts the tool remains callable in both, so this correction rests on an
executed differential rather than on a source reading. The expected delta is
`exec.description` content/size **plus** `tool_search` construction and the
deferred-guidance text — not `exec.description` alone.

This reframes the override honestly: for an eligible tool under code mode it is a
*model-comprehension* lever (the model sees full schemas inline instead of having
to consult `ALL_TOOLS`), not a *reachability* lever. `010`'s non-goal list already
says "no claim that `direct` is cheaper or preferred"; it must also say direct is
not a reachability fix for eligible tools under code mode. `044`'s weak-model
fallback rationale is the honest use case.

Caveat recorded rather than assumed away: the inspected clone is dated 2026-07-23,
while #1522 reported against CLI `0.147.0-alpha.6.5` on 2026-08-12. Whether the
shipped App build has additional app-layer gating is **not** established by this
pass. E1/E2 in `009` stay open.

## Correction 3 — `CatalogModel` is not in `src/types.ts`

`003` and `011` place the `toolDiscoveryMode` carrier under "Data model /
`src/types.ts`". The interface actually lives in `src/codex/catalog/parsing.ts:94`,
alongside `parallelToolCalls`, `supportsVerbosity` and `supportsReasoningSummaries`.

Only the **config** fields (`routedToolDiscovery`, `modelRoutedToolDiscovery`)
belong in `src/types.ts` on `OcxProviderConfig`. The resolved carrier belongs in
`parsing.ts`. Following the documents literally would have created a second
`CatalogModel` or an import cycle.

## Correction 4 — `modelRecordValue()` does not match dated variants

`010` promises an "exact/date-compatible model override" and `013` instructs:

> Use `modelRecordValue()` for the per-model map so dated or normalized variants
> follow the same matching behavior as existing model metadata.

`modelRecordValue` (`src/reasoning-effort.ts:49-62`) matches exactly three ways:
exact own-property, the prefix before a `:`, and a case-insensitive full-id match.
It does **not** match `-YYYYMMDD` suffixes. Dated matching is a separate helper,
`isDatedVariantId()` at `provider-fetch.ts:805-808`.

So a `glm-5.2` override will not apply to `glm-5.2-20260813` through
`modelRecordValue` alone. Either the resolver composes both helpers, or the
documents must stop promising date compatibility. **Decision: keep
`modelRecordValue` semantics only** — matching every sibling model-keyed override
in the codebase is worth more than a bespoke matcher, and an operator pinning an
emergency escape hatch should name the exact model id that failed. `010` and `013`
are amended to say "exact model override" without the date claim.

## Correction 5 — the config schema will not validate a new provider field

`011` proposes a `.catch()`-bearing zod field and assumes it slots into the
provider schema. In reality `providerConfigSchema` (`src/config.ts:616-645`)
declares only a minority of `OcxProviderConfig` fields and ends with
`.passthrough()`. It contains no `.catch()` anywhere.

A field added only to the TypeScript interface is therefore **passed through
entirely unvalidated** — neither degraded on load nor rejected on write. Both
halves of `011`'s config contract have to be built explicitly:

- declare the fields in `providerConfigSchema` with `.catch(undefined)` for
  load-path degradation;
- add a boundary validator to the `validateConfigCandidate` chain
  (`config.ts:2298-2312`) that inspects the raw candidate before `.catch()` erases
  it, emitting the house format `schema_invalid: providers.<name>.<field>: <message>`.

## Correction 6 — the touch map is missing `aggregation.ts`

`012` specifies a combo rule ("any member direct → combo direct") but `003`'s file
list never names the file that would implement it. Combo capability derivation
lives in `deriveComboCatalogModel()` at `src/codex/catalog/aggregation.ts:125-177`.

The proposed rule is directionally consistent with house precedent — the existing
flags use `members.every(...)` to grant a capability, and "direct wins" is the same
shape as "deferred only if every member is deferred". The file simply has to be in
the plan.

## Correction 7 — the `parallelToolCalls` precedent is incomplete

`013`'s propagation chain models itself on `parallelToolCalls`. That precedent is
correct for the **template** path only. The template-less fallback never passes
`parallelToolCalls` into normalization at all, and `ensureStrictCatalogFields`
defaults a missing `supports_parallel_tool_calls` to `true`
(`parsing.ts:293-306`).

The new field must therefore emit explicitly on **both** construction paths and
must never rely on a strict-field default to carry policy.

## Correction 8 — the Cursor fence is inconsistent across the two paths, today

This is an unresolved P2 review finding from #1596, not a new defect, but it lands
directly on this unit's surface:

- template path: `entry.slug.startsWith("cursor/")` (`parsing.ts:395`)
- template-less path: `model?.provider === "cursor"` (`sync.ts:313`)

A combo whose public alias begins `cursor/` but whose canonical provider is
`combo` is classified **differently depending on whether a template was
available**. Discovery mode and payload size then depend on template availability
— a real behavior defect.

`012` preserves the slug check verbatim and so would inherit the inconsistency.
Since this unit is already unifying both paths behind one resolver, it should
close the asymmetry rather than reproduce it: the fence resolves from provider
identity, with the slug prefix retained only as a fallback when no `CatalogModel`
is available. Recorded as a first-PR requirement.

## Repository-state findings the bundle could not have known

- **Issue #1522 is closed**, at `2026-08-12T20:22:45Z`, with the comment "Fixed by
  #1515". That attribution is wrong — #1515 concerns account-scoped native model
  ids. The incident is closed under a false cause, which is worth noting before
  citing it as live justification.
- **Issue #1587** ("routed first-turn tool catalog is 3–5x native Sol input
  tokens") is open and is the standing argument against any return to a blanket
  `false` default. It supports this unit's default-preserving stance.
- **#1596's three inline review threads are all still unresolved**: the
  provider-identity/alias P2 (Correction 8), a request to publish the referenced
  measurement record — `devlog/_plan/260813_tool_catalog_deferral/010` does not
  exist anywhere in history — and a CodeRabbit note that
  `structure/03_catalog-and-subagents.md` wrongly says Cursor "advertises neither
  flag" when the implementation does emit `supports_search_tool: false`.
- **Open PR collisions** the PR stack must be sequenced around:
  - #1604 (draft) touches `parsing.ts` and `sync.ts` — direct textual collision.
  - #1521 (draft) touches `parsing.ts`, `config.ts`, `types.ts` and provider
    capability configuration — the strongest architectural collision.
  - #1602 (draft) promotes client `tool_search_output` definitions into active
    upstream tool declarations — adjacent semantic collision with any discovery
    override.

## Net effect on the roadmap

The phase structure stands. The first PR's scope grows by one file
(`aggregation.ts`), gains one requirement (unify the Cursor fence on provider
identity), loses one promise (date-compatible model keys), and must build config
validation from scratch rather than extending an existing validated field.

Correction 2 changes what the feature is *sold as*, which is the most consequential
edit in this pass: the override is a comprehension and compatibility lever with a
measured payload cost, not a fix for tools being unreachable.
