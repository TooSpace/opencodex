# 029 - Phase 2 exit gate

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
