import { afterEach, describe, expect, test } from "bun:test";
import { transientRetryPolicyFor } from "../src/providers/key-failover";
import { handleResponses } from "../src/server/responses";
import { transientRetryOn5xxPolicyConfigError } from "../src/config";
import type { OcxConfig, OcxProviderConfig } from "../src/types";

describe("transientRetryPolicyFor", () => {
  test("null when absent or explicitly disabled", () => {
    expect(transientRetryPolicyFor({} as OcxProviderConfig)).toBeNull();
    expect(transientRetryPolicyFor({ transientRetryOn5xx: { enabled: false } } as OcxProviderConfig)).toBeNull();
  });

  test("null for OAuth, forward, local, and unknown auth modes (fail closed)", () => {
    expect(transientRetryPolicyFor({
      authMode: "oauth",
      transientRetryOn5xx: {},
    } as OcxProviderConfig)).toBeNull();
    expect(transientRetryPolicyFor({
      authMode: "forward",
      transientRetryOn5xx: {},
    } as OcxProviderConfig)).toBeNull();
    expect(transientRetryPolicyFor({
      authMode: "local",
      transientRetryOn5xx: {},
    } as OcxProviderConfig)).toBeNull();
    expect(transientRetryPolicyFor({
      authMode: "custom-unknown",
      transientRetryOn5xx: {},
    } as OcxProviderConfig)).toBeNull();
    expect(transientRetryPolicyFor({
      authMode: "key",
      transientRetryOn5xx: {},
    } as OcxProviderConfig)).not.toBeNull();
  });

  test("applies defaults when the object is present", () => {
    expect(transientRetryPolicyFor({ transientRetryOn5xx: {} } as OcxProviderConfig)).toEqual({
      enabled: true,
      attempts: 3,
    });
  });

  test("honors explicit attempts", () => {
    expect(transientRetryPolicyFor({
      transientRetryOn5xx: { attempts: 5 },
    } as OcxProviderConfig)).toEqual({
      enabled: true,
      attempts: 5,
    });
  });
});

describe("transientRetryOn5xxPolicyConfigError", () => {
  test("accepts undefined and valid policies", () => {
    expect(transientRetryOn5xxPolicyConfigError(undefined)).toBeNull();
    expect(transientRetryOn5xxPolicyConfigError({})).toBeNull();
    expect(transientRetryOn5xxPolicyConfigError({ enabled: true, attempts: 3 })).toBeNull();
  });

  test("rejects invalid field values", () => {
    expect(transientRetryOn5xxPolicyConfigError({ enabled: "yes" })).toContain("enabled");
    expect(transientRetryOn5xxPolicyConfigError({ attempts: 0 })).toContain("attempts");
    expect(transientRetryOn5xxPolicyConfigError({ attempts: 99 })).toContain("attempts");
  });

  test("rejects unknown fields without echoing secret-shaped names", () => {
    const err = transientRetryOn5xxPolicyConfigError({ intervalMs: 1000 });
    expect(err).toContain("unrecognized");
    expect(err).toContain("intervalMs");
  });
});

describe("transient-5xx fetch path", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function makeConfig(transientRetryOn5xx?: unknown): OcxConfig {
    return {
      port: 0,
      defaultProvider: "corp",
      providers: {
        corp: {
          adapter: "openai-chat",
          baseUrl: "https://gateway.corp.example",
          authMode: "key",
          apiKey: "key-alpha-000111222333",
          ...(transientRetryOn5xx !== undefined ? { transientRetryOn5xx } : {}),
        },
      },
    } as OcxConfig;
  }

  function postResponses(config: OcxConfig): Promise<Response> {
    return handleResponses(new Request("http://localhost/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "corp/some-model", input: "hello", stream: false }),
    }), config, { model: "corp/some-model", provider: "corp" });
  }

  function okPayload(): Response {
    return new Response(JSON.stringify({
      id: "chatcmpl-mock",
      object: "chat.completion",
      created: 1,
      model: "some-model",
      choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }

  test("503 then success: retries transparently and returns 200", async () => {
    let sends = 0;
    globalThis.fetch = (async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.startsWith("https://gateway.corp.example/")) {
        sends += 1;
        if (sends < 3) {
          return new Response(JSON.stringify({ error: { message: "server_is_overloaded" } }),
            { status: 503, headers: { "content-type": "application/json" } });
        }
        return okPayload();
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    const response = await postResponses(makeConfig({ attempts: 3 }));
    expect(response.status).toBe(200);
    expect(sends).toBe(3);
  });

  test("retries exhausted: final 503 is surfaced to the client", async () => {
    let sends = 0;
    globalThis.fetch = (async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.startsWith("https://gateway.corp.example/")) {
        sends += 1;
        return new Response(JSON.stringify({ error: { message: "server_is_overloaded" } }),
          { status: 503, headers: { "content-type": "application/json" } });
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    const response = await postResponses(makeConfig({ attempts: 2 }));
    expect(response.status).toBe(503);
    expect(sends).toBe(2);
  });

  test("no opt-in: 503 is surfaced immediately with a single send", async () => {
    let sends = 0;
    globalThis.fetch = (async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.startsWith("https://gateway.corp.example/")) {
        sends += 1;
        return new Response(JSON.stringify({ error: { message: "server_is_overloaded" } }),
          { status: 503, headers: { "content-type": "application/json" } });
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    const response = await postResponses(makeConfig());
    expect(response.status).toBe(503);
    expect(sends).toBe(1);
  });

  test("explicitly disabled: 503 is surfaced immediately", async () => {
    let sends = 0;
    globalThis.fetch = (async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.startsWith("https://gateway.corp.example/")) {
        sends += 1;
        return new Response(JSON.stringify({ error: { message: "server_is_overloaded" } }),
          { status: 503, headers: { "content-type": "application/json" } });
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    const response = await postResponses(makeConfig({ enabled: false }));
    expect(response.status).toBe(503);
    expect(sends).toBe(1);
  });

  test("400 is never retried even with the policy enabled", async () => {
    let sends = 0;
    globalThis.fetch = (async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.startsWith("https://gateway.corp.example/")) {
        sends += 1;
        return new Response(JSON.stringify({ error: { message: "bad request" } }),
          { status: 400, headers: { "content-type": "application/json" } });
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    const response = await postResponses(makeConfig({ attempts: 3 }));
    expect(response.status).toBe(400);
    expect(sends).toBe(1);
  });
});

