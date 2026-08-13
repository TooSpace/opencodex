# 092 - Definition of done

## Phase 1 done

- typed resolver merged;
- defaults unchanged;
- exact overrides work;
- diagnostics present;
- full suite green.

## Programme done

- adapter conformance is fixture-driven;
- exact #1522 scenario has a recorded disposition;
- live canaries cover CLI and App;
- dynamic tools, compaction and resume are safe;
- payload and cache thresholds are data-backed;
- meta-tools, if shipped, reuse authorization and have high recall;
- auto selection, if shipped, uses versioned expiring evidence;
- rollback is rehearsed;
- documentation separates hosted search, discovery and execution.

## Evidence standard

A claim is complete only when it states:

```text
what was tested + exact versions + fixed inputs + observed outputs + limitations
```

“No error” is not sufficient. A tool test must prove actual execution and result use.
