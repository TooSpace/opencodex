# 045 - Dynamic MCP `tools/list_changed` scenario

## Setup

Use an MCP server that starts with two tools and registers a third tool after the session begins, then emits `notifications/tools/list_changed`.

## Sequence

1. start session;
2. verify initial index;
3. register `dynamic_echo`;
4. emit list-changed;
5. search by exact name;
6. call tool;
7. remove tool;
8. search and call again.

## Expected

- side index refreshes without changing the top-level prompt manifest where possible;
- new tool becomes discoverable;
- removed tool produces structured unavailable result;
- no dangling transcript reference poisons later turns;
- cache prefix does not rebuild solely because the tool registry changed.

## Instrumentation

Record manifest hash before/after, index generation and cache-read/write token metrics when the client exposes them.
