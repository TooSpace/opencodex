# 029 - Phase 2 exit gate

> **Status 2026-08-13: Phase 2 is NOT fully closed.** The configuration and
> catalog-policy half shipped (see PR "feat(codex): add routed tool-discovery
> compatibility profiles"), but two planned items remain OPEN and are carried as
> explicit debt rather than quietly dropped:
>
> - **`020` single-variable code-mode differential** — still owed. Until it runs,
>   the claim in `004`/`094` that `direct` is a comprehension lever rather than a
>   reachability fix rests on a source reading of a 2026-07-23 upstream clone.
>   It needs a running Codex client, so it belongs to the live phase, not the
>   configuration PR.
> - **`024` model-map divergence and warm-cache policy refresh** — the shipped
>   suite covers provider-policy divergence and concurrent admission separation;
>   these two remain worthwhile local tests.
>
> Everything else in `020`-`025` is covered by
> `tests/codex-tool-discovery-mode.test.ts`, including the `023` backward-compat
> set and the `025` combo compositions.

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
