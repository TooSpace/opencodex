# 029 - Phase 2 exit gate

> **Status 2026-08-13: Phase 2 is NOT closed.** The configuration and
> catalog-policy half shipped (see PR "feat(codex): add routed tool-discovery
> compatibility profiles"), and an earlier revision of this note claimed the
> `020` differential was the only thing left. An independent audit disproved
> that. The honest remaining list:
>
> - **`020` single-variable code-mode differential** — still owed. Until it
>   runs, the claim in `004`/`094` that `direct` is a comprehension lever rather
>   than a reachability fix rests on a source reading of a 2026-07-23 upstream
>   clone. It needs a running Codex client, so it belongs to the live phase
>   rather than the configuration PR. The docs now label that conclusion
>   source-derived rather than proven.
> - **`023` zero-config comparison against a real prior build** — the suite pins
>   the exact emitted key set on both construction paths, which is strong
>   regression coverage, but it is not the documented normalized diff of a
>   current-`dev` catalog against a patched one.
> - **`025` forcing-member diagnostic** — the combo explain surface does not yet
>   name which member forced `direct`. Derivation itself is covered.
>
> Closed since that earlier revision, with ablation evidence recorded in
> `tests/codex-tool-discovery-mode.test.ts`: the `024` concurrency set (a
> latched provider `fetch` proves identical policies JOIN one flight and
> differing policies SPLIT, including model-map divergence and warm-cache
> re-resolution), the full `025` five-row matrix plus deferred-key omission and
> every alias shape (bare, slashed, native), each pinned to an exact emitted slug so
> deleting alias propagation turns them red, the `023` on-disk load/save
> round trip and downgrade preservation, and the `020` malformed-load warning.
>
> The retracted claim is left visible on purpose: this unit exists because a
> plan asserted more verification than it had.

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
