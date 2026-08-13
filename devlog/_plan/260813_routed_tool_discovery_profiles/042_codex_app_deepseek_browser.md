# 042 - Exact #1522 scenario: Codex App + DeepSeek + Browser

Priority: P0

## Fixed setup

- current stable Codex App and bundled CLI version recorded;
- current OpenCodex `dev` build;
- Browser plugin enabled and authenticated;
- one DeepSeek-compatible routed model;
- same workspace and prompt for both arms.

## Arm A — current default

```json
{
  "tool_mode": "code_mode_only",
  "supports_search_tool": true
}
```

## Arm B — exact model override

```json
{
  "modelRoutedToolDiscovery": {
    "<model-id>": "direct"
  }
}
```

## Prompt battery

1. navigate to a deterministic local/static URL;
2. read page title;
3. take screenshot;
4. report one DOM fact;
5. perform one second browser action in the same session.

Do not name `mcp__node_repl__js` in the discoverability run.

## Capture

- whether Browser tools appear in `ALL_TOOLS`;
- whether they exist on `tools`;
- first-request bytes;
- tool call sequence;
- model text when it fails;
- second-turn behavior.

## Decision

| Outcome | Action |
|---|---|
| A passes and is materially smaller | keep deferred; close evidence gap |
| A fails, B passes | document exact model/client direct override |
| both fail | problem is not discovery flag; inspect plugin/client lifecycle |
| A calls wrong tool | acquisition issue; evaluate meta-tool profile |
