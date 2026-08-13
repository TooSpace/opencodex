# 021 - Catalog test cases

| ID | Input | Expected |
|---|---|---|
| C01 | non-Cursor, no override | `code_mode_only`, search true, hosted search present |
| C02 | non-Cursor provider direct | `code_mode_only`, search false, hosted search present |
| C03 | provider direct + model deferred | target model true; siblings false |
| C04 | provider deferred + model direct | target model false; siblings true |
| C05 | Cursor no override | search false; hosted search absent |
| C06 | Cursor configured deferred | still false; warning/diagnostic |
| C07 | native OpenAI row | unchanged from snapshot |
| C08 | template-less non-Cursor | same policy as template path |
| C09 | template-less Cursor | same hard fence |
| C10 | combo all deferred | combo true |
| C11 | combo one direct | combo false |
| C12 | bare combo alias | still treated as routed and policy applied |
| C13 | account-qualified native row | unchanged |
| C14 | model date variant | override resolved via existing model helper |
| C15 | model alias mismatch | no accidental sibling match |

## Exact assertion style

Avoid broad snapshots as the only fence. Pin the load-bearing pair explicitly:

```ts
expect(row.tool_mode).toBe("code_mode_only");
expect(row.supports_search_tool).toBe(true);
```

For direct mode:

```ts
expect(row.tool_mode).toBe("code_mode_only");
expect(row.supports_search_tool).toBe(false);
expect(row.web_search_tool_type).toBe("text_and_image");
```

The third assertion prevents hosted search from being accidentally coupled to discovery mode.
