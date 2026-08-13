# 014 - Phase 1: diagnostics and operator feedback

## Why diagnostics are required

A direct override solves compatibility at the cost of potentially large first requests. Silent operation would repeat the same observability failure as #1529, only at smaller scope.

## Recommended management DTO

> **Amended 2026-08-13:** the DTO reports the mode OpenCodex *advertises*, which
> is not necessarily the mode the client *applies*. Upstream gates deferred
> discovery on `supports_search_tool && namespace_tools_enabled`
> (`spec_plan.rs:330`), so a route can run direct without any override. Word the
> diagnostic as advertised policy, never as effective runtime state
> (`094_landing_verification_pass.md` Correction 1).

Expose a derived, non-secret object per catalog row/provider model:

```json
{
  "resolvedToolDiscovery": {
    "mode": "direct",
    "source": "model-override",
    "reason": "providers.deepseek.modelRoutedToolDiscovery.glm-5.2",
    "warning": "Direct discovery may include full MCP declarations"
  }
}
```

This is management-only metadata; it need not be written into the Codex catalog.

## CLI output

Suggested command extension:

```text
ocx models explain deepseek/glm-5.2
```

Minimum output:

```text
Tool discovery: direct
Resolved from: providers.deepseek.modelRoutedToolDiscovery.glm-5.2
Code mode: code_mode_only
Hosted web search: enabled
Warning: direct discovery can increase the first-request payload
```

## Warning thresholds

When request-build instrumentation is available, warn when direct mode sees either:

- more than 100 nested tools;
- more than 128 KiB of declaration/schema text;
- more than 256 KiB total first-request body.

These are initial operational thresholds, not API limits. Calibrate from real captures before enforcing a hard failure.

## Privacy

Do not log:

- full tool schemas;
- tool arguments;
- credentials or headers;
- user prompt content.

Safe telemetry is counts, byte sizes, hashes, selected mode and source.
