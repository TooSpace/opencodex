# 029 - Phase 2 exit gate

> **Status 2026-08-13: Phase 2 is NOT fully closed — ONE item remains open.**
> The configuration and catalog-policy half shipped (see PR "feat(codex): add
> routed tool-discovery compatibility profiles").
>
> - **`020` single-variable code-mode differential** — still owed, and the only
>   open item. Until it runs, the claim in `004`/`094` that `direct` is a
>   comprehension lever rather than a reachability fix rests on a source reading
>   of a 2026-07-23 upstream clone. It needs a running Codex client, so it
>   belongs to the live phase, not the configuration PR.
>
> Everything else in `020`-`025` is covered by
> `tests/codex-tool-discovery-mode.test.ts`: the `023` backward-compat set, the
> `025` combo compositions, and — as of the latched-fetch concurrency harness —
> the full `024` set including model-map divergence and warm-cache policy
> re-resolution. An earlier revision of this note listed those two `024` cases as
> open; they had already landed, and the correction is recorded here rather than
> silently edited away.

Phase 2 is complete only when:

- [ ] pure resolver tests pass;
- [ ] template and fallback catalog tests pass;
- [ ] config load/write tests pass;
- [ ] combo composition tests pass;
- [ ] concurrent gather identity tests pass;
- [ ] zero-config catalog comparison is clean;
- [ ] full Bun suite passes;
- [ ] no privacy scan regression;
- [ ] direct mode warning is observable.

A passing unit suite without the zero-config comparison is insufficient: the primary promise of PR A is that #1596 remains the default.
