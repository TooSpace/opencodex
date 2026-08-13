# 023 - Backward-compatibility tests

## Zero-config byte compatibility

Build the same catalog on current `dev` and patched code with no new fields. Compare normalized JSON.

Allowed differences:

- none in discovery-owned fields;
- no ordering change;
- no new serialized OpenCodex extension.

## Existing direct Cursor behavior

Existing Cursor tests must remain unchanged:

- no `web_search_tool_type`;
- `supports_search_tool=false`;
- parallel tool calls remain as currently advertised.

## PR #1596 regression fence

The original focused tests must still pass. Add one explicit test proving that an ordinary provider with no override remains true even after resolver introduction.

## Existing configs

Load fixtures from before the new fields existed. Their parsed output should not gain persisted fields on a no-op read. Saving an unrelated field should not write an explicit default unless OpenCodex normally materializes optional defaults.

## Downgrade behavior

An older OpenCodex binary sees unknown provider fields through `.passthrough()` and should preserve them during unrelated config saves. Verify against the current schema strategy where practical.
