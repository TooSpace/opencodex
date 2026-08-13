# 025 - Combo policy tests

## Composition rule

```ts
members.some(member => member.toolDiscoveryMode === "direct")
  ? "direct"
  : "deferred";
```

## Cases

| Members | Expected combo |
|---|---|
| deferred + deferred | deferred |
| deferred + direct | direct |
| direct + direct | direct |
| undefined + deferred | deferred during migration |
| undefined + direct | direct |

## Rationale

A combo catalog row is selected before the concrete target is known. Advertising deferred while a possible target requires direct can make that target unusable. Direct is more expensive but compatible with both member classes, so it is the conservative intersection.

## Diagnostics

The combo explain surface should say which member forced direct mode:

```text
combo/mixed -> direct
reason: member deepseek/glm-5.2 is configured direct
```

## Alias coverage

Run the same cases for:

- normal `combo/<id>` slug;
- bare alias;
- slashed alias;
- explicit native alias where allowed.
