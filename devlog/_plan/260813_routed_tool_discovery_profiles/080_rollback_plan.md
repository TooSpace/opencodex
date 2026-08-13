# 080 - Rollback plan

## PR A rollback

Code rollback:

- remove resolver module and propagation;
- restore `normalizeRoutedCatalogEntry()` default Boolean;
- remove optional fields from active docs/schema.

Config rollback is simpler: delete `routedToolDiscovery` and `modelRoutedToolDiscovery`. Missing fields return #1596 behavior.

## Runtime emergency rollback

If a release causes broad plugin loss:

1. disable auto evidence selection if present;
2. restore non-Cursor deferred default;
3. retain exact direct overrides for confirmed affected routes;
4. publish client/version-specific advisory;
5. avoid blanket direct unless payload impact is accepted explicitly.

## Meta-tool rollback

Disable the profile flag and return to Code Mode/default. Because underlying tools remain in the normal registry, removing meta-tools should not alter authorization state.

## Data compatibility

Evidence and diagnostics are derived state. They may be discarded. User configuration must remain preserved by older binaries through passthrough behavior.
