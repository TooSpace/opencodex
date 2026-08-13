# 050 - Phase 5: payload and cache benchmarks

## Questions

1. How much first-request text does each profile add?
2. Does cost scale with tool count, description bytes or schema bytes?
3. Does loading a tool mutate the cached prefix?
4. What happens after compaction and dynamic tool changes?

## Profiles

- eager/direct full declarations;
- Code Mode name/description index;
- native tool search;
- proxy meta-tools.

## Sizes

Test 0, 10, 50, 100, 250, 500 and 1,000 tools. Use multiple schema shapes:

- small flat function;
- nested object;
- enum-heavy;
- long descriptions;
- namespace groups;
- custom/freeform.

## Metrics

- request UTF-8 bytes;
- estimated/tokenizer tokens when available;
- cache read/write tokens;
- time to first model byte;
- time to first tool call;
- total turns to completion;
- acquisition success.

## Included synthetic benchmark

`prototype/payload-benchmark.mjs` compares structural UTF-8 bytes. It is not a live Codex capture or token estimate.
