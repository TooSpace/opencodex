# 044 - Weak-model acquisition scenario

## Hypothesis

Some external models can call tools but do not reliably search `ALL_TOOLS` or compose Code Mode JavaScript. For them, a purpose-built search tool may outperform both local Code Mode discovery and an eager catalog.

## Three-arm eval

### A — loaded tool

Required tool is directly visible.

### B — Code Mode index

Tool is available only through `ALL_TOOLS`/`tools`.

### C — proxy meta-tools

Tool is available through `ocx_tool_search` → `ocx_tool_describe` → `ocx_tool_call`.

## Task battery

Use at least 30 tasks across:

- exact tool-name clue;
- semantic description only;
- namespace ambiguity;
- permission-blocked tool;
- two-step workflow;
- similar-name decoys.

## Metrics

- correct acquisition rate;
- wrong-tool rate;
- unnecessary user-question rate;
- invented workaround rate;
- false “not possible” rate;
- turns and bytes to successful call.

## Selection rule

Do not switch a model to meta-tools based on one anecdote. Require statistically meaningful improvement or a deterministic conformance failure.
