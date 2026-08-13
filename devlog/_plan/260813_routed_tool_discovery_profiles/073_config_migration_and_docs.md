# 073 - Config migration and documentation

## Migration

No migration is necessary. Missing fields mean `auto`.

## Example: exact model fallback

```json
{
  "providers": {
    "deepseek": {
      "adapter": "openai-chat",
      "baseUrl": "https://example.invalid/v1",
      "modelRoutedToolDiscovery": {
        "deepseek-v4-pro": "direct"
      }
    }
  }
}
```

## Example: provider-wide diagnostic override

```json
{
  "routedToolDiscovery": "direct"
}
```

Document that provider-wide direct mode is a broad compatibility fallback and can materially increase context/cost.

## Required docs

- configuration reference;
- troubleshooting: plugin missing versus translator missing tools;
- explanation of hosted search versus tool discovery;
- payload warning;
- Cursor hard fence;
- how to collect a redacted canary bundle;
- how to remove override after a client fix.
