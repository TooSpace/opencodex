# 034 - Streaming and non-streaming matrix

| Stage | Streaming assertions | Non-streaming assertions |
|---|---|---|
| declaration | same translated tool set | same translated tool set |
| call start | one output item/call id | one call object/call id |
| arguments | ordered fragments, valid final JSON/freeform | exact arguments |
| call end | exactly one terminal event | completed call |
| tool output | paired by call id | paired by call id |
| final response | loop continues | loop continues |
| error | structured, no fake completion | structured, no fake completion |

## Fragmentation cases

- UTF-8 character split across chunks;
- JSON string escape split;
- two parallel calls interleaved;
- one custom freeform call;
- reasoning/text before tool call;
- tool call followed by transport error.

## Equality check

Normalize both modes into canonical `OcxToolCall` objects and compare:

```text
name, namespace, custom type, arguments, call id
```

Differences in event timing are allowed. Differences in semantic tool identity are not.
