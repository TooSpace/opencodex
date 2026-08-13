# 024 - Catalog cache and concurrency tests

## Why

`gatherRoutedModels()` deduplicates concurrent work. If discovery policy is omitted from its identity, a direct request can receive a deferred catalog—or the reverse—depending on which call entered first.

## Test A — fingerprint divergence

Create two configs differing only in:

```json
"routedToolDiscovery": "deferred"
```

versus:

```json
"routedToolDiscovery": "direct"
```

Assert gather keys or returned rows differ.

## Test B — model-map divergence

Same provider-wide mode; change one model override. Assert only the matching row changes.

## Test C — concurrent flights

Block provider discovery behind a test promise, start both configs concurrently, then release. They must execute distinct admissions and publish their own policy.

## Test D — cache refresh

1. gather deferred;
2. cache result;
3. mutate config to direct;
4. gather again;
5. ensure stale cached row is not reused.

## Test E — warning memo lifecycle

If direct-mode payload warnings are memoized, config generation reconciliation must clear stale signatures when the effective policy changes.
