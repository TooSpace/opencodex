# 032 - Custom and namespace round-trip scenarios

## Tool kinds

### Function

Structured JSON arguments. Must return a normal function call.

### Custom/freeform

Example: `exec` or `apply_patch`. The translator may wrap freeform text as:

```json
{ "input": "raw source text" }
```

but must remember the original type and restore a custom tool call to Codex.

### Namespace

Must preserve both:

```text
namespace + function name
```

Flattening to one string is acceptable only inside protocols that require it, and the reverse mapping must be exact.

## Collision tests

- plain `search` and namespace `github.search`;
- two namespaces with the same short name;
- custom and function sharing a translated alias;
- exact qualified name versus suffix fallback.

Plain tools should win plain-name resolution. Namespace calls require their original namespace; never guess from a suffix when two candidates exist.

## Response tests

For streaming and non-streaming:

- original custom -> custom event;
- original function -> function event;
- namespace metadata restored;
- stable call id;
- fragmented arguments reconstructed once;
- no duplicate tool execution.
