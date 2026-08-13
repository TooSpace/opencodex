# 031 - Responses Lite `additional_tools` scenarios

## Regression class

Codex Responses Lite can place tool definitions under:

```json
{
  "input": [
    {
      "type": "additional_tools",
      "role": "developer",
      "tools": []
    }
  ]
}
```

A translator that reads only top-level `tools` silently strips the complete execution surface.

## Request tests

1. top-level tools only;
2. `additional_tools` only;
3. both sources;
4. multiple `additional_tools` items;
5. duplicate names across sources;
6. custom + function + namespace in one item;
7. empty items;
8. malformed item must fail explicitly.

## Merge rule

- stable declaration order;
- top-level definition wins an exact collision;
- deduplicate by translated qualified name;
- preserve original tool kind in a side map.

## End-to-end assertion

A prompt requesting `pwd` must produce:

```text
assistant tool call -> client execution -> tool output -> second model request -> final answer
```

A normal `response.completed` after only “I will run pwd” is a failure, not success.

## Fixtures

Use the exact Responses Lite shape from the CLIProxyAPI regression as one fixture, with secrets and provider identifiers removed.
