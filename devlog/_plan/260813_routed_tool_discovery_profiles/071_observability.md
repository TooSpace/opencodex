# 071 - Observability plan

## Per catalog row

- resolved mode/profile;
- resolution source;
- policy/evidence revision;
- client/surface scope when known.

## Per request

- profile;
- top-level visible tool count;
- nested/indexed tool count;
- declaration bytes;
- total request bytes;
- manifest hash;
- search/describe counts;
- first tool-call latency;
- final success/failure stage.

## Per session

- manifest changes;
- compactions;
- cache read/write totals;
- unavailable/dangling tool references;
- profile switches—normally zero.

## Redaction

Store counts/hashes, not schemas, arguments, credentials or user prompts. Provide an explicit diagnostic capture command for users who consent to a redacted bundle.

## Alert candidates

- zero tools after translation when input declared tools;
- direct mode over warning thresholds;
- top-level manifest hash changes mid-session;
- repeated tool-search misses;
- normal completion immediately after a declared mandatory tool task;
- resume validation loop.
