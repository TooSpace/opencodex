# 065 - Meta-tool test plan

## Search

- exact name first;
- namespace filter;
- unique short name;
- ambiguous short name;
- top-k and pagination;
- stable order under ties;
- authorized subset only;
- dynamic generation update.

## Describe

- one and three names;
- over-limit request;
- schema-byte cap;
- removed tool;
- mixed valid/invalid names;
- custom/freeform schema representation.

## Call

- normal success;
- invalid arguments;
- denied server;
- denied tool;
- IP restriction;
- pre-call hook rejection;
- cancellation/timeout;
- result cap;
- namespace collision;
- stale generation.

## E2E

Run the same task through direct, Code Mode and meta-tool profiles. Assert final external side effect/result is identical and authorization decisions are identical.
