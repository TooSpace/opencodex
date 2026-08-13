# 039 - Phase 3 exit gate

A route may be marked native-tool-search compatible only when all are true:

- [ ] top-level and Responses Lite declarations preserved;
- [ ] custom/function/namespace types round-trip;
- [ ] search call/output history replays;
- [ ] discovered tool activates on the next request;
- [ ] streaming and non-streaming are semantically equal;
- [ ] continuation passes;
- [ ] compaction passes;
- [ ] process resume passes;
- [ ] transient references are safe;
- [ ] failures are explicit;
- [ ] exact adapter/client version recorded.

One successful first-turn tool call is not sufficient certification.
