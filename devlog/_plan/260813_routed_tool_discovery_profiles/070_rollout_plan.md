# 070 - Rollout plan

## Stage 0 — docs and prototype

Ship no runtime change. Review the mode vocabulary, resolver and test matrix.

## Stage 1 — explicit override, default unchanged

Land PR A. Non-Cursor remains deferred; Cursor remains direct. Overrides are config-only and diagnostics warn on direct mode.

## Stage 2 — protocol conformance

Land adapter fixtures and evidence reporting. Do not auto-select yet.

## Stage 3 — live canaries

Certify target client/adapter combinations, especially the exact #1522 pairing.

## Stage 4 — bounded meta-tools

Opt in only for models/routes with demonstrated acquisition benefit or native incompatibility.

## Stage 5 — evidence-driven auto mode

Only after versioned evidence exists may `auto` choose among profiles. Keep explicit override as final authority.

## Compatibility promise

Every stage is additive. Removing optional config/evidence restores #1596 defaults.
