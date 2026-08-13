# 082 - Configuration examples

## Default—recommended

No field:

```json
{
  "adapter": "openai-chat",
  "baseUrl": "https://provider.example/v1"
}
```

Result: non-Cursor deferred, Cursor direct.

## One known-bad model

```json
{
  "modelRoutedToolDiscovery": {
    "glm-5.2": "direct"
  }
}
```

## Broad provider diagnostic

```json
{
  "routedToolDiscovery": "direct"
}
```

Use temporarily while isolating a provider-wide compatibility issue.

## Explicit return to default

```json
{
  "routedToolDiscovery": "auto"
}
```

or remove the key.

## Mixed gateway

```json
{
  "routedToolDiscovery": "deferred",
  "modelRoutedToolDiscovery": {
    "legacy-model": "direct",
    "fixed-model": "auto"
  }
}
```

`fixed-model:auto` resolves to the non-Cursor default, not the provider's direct/deferred value. This is intentional if model-level `auto` is defined as “re-evaluate default.” The implementation and docs must pin this semantic; an alternative is to treat model `auto` as inheritance. The recommended design here uses default re-evaluation.
