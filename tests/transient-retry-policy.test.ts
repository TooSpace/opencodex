import { describe, expect, test } from "bun:test";
import { transientRetryPolicyFor } from "../src/providers/key-failover";
import type { OcxProviderConfig } from "../src/types";

describe("transientRetryPolicyFor", () => {
  test("returns null when transientRetryOn5xx is absent", () => {
    const provider = { adapter: "openai-chat", baseUrl: "http://x/v1" } as OcxProviderConfig;
    expect(transientRetryPolicyFor(provider)).toBeNull();
  });

  test("returns null when explicitly disabled", () => {
    const provider = {
      adapter: "openai-chat",
      baseUrl: "http://x/v1",
      transientRetryOn5xx: { enabled: false },
    } as OcxProviderConfig;
    expect(transientRetryPolicyFor(provider)).toBeNull();
  });

  test("returns defaults for a bare opt-in", () => {
    const provider = {
      adapter: "openai-chat",
      baseUrl: "http://x/v1",
      transientRetryOn5xx: {},
    } as OcxProviderConfig;
    const policy = transientRetryPolicyFor(provider);
    expect(policy).not.toBeNull();
    expect(policy!.enabled).toBe(true);
    expect(policy!.attempts).toBe(3);
    expect(policy!.baseDelayMs).toBe(400);
    expect(policy!.maxDelayMs).toBe(5_000);
  });

  test("returns null for oauth providers", () => {
    const provider = {
      adapter: "openai-chat",
      baseUrl: "http://x/v1",
      authMode: "oauth",
      transientRetryOn5xx: {},
    } as OcxProviderConfig;
    expect(transientRetryPolicyFor(provider)).toBeNull();
  });

  test("returns null for forward providers", () => {
    const provider = {
      adapter: "openai-chat",
      baseUrl: "http://x/v1",
      authMode: "forward",
      transientRetryOn5xx: {},
    } as OcxProviderConfig;
    expect(transientRetryPolicyFor(provider)).toBeNull();
  });

  test("honours custom attempts and delays", () => {
    const provider = {
      adapter: "openai-chat",
      baseUrl: "http://x/v1",
      transientRetryOn5xx: { attempts: 5, baseDelayMs: 200, maxDelayMs: 10_000 },
    } as OcxProviderConfig;
    const policy = transientRetryPolicyFor(provider);
    expect(policy).not.toBeNull();
    expect(policy!.attempts).toBe(5);
    expect(policy!.baseDelayMs).toBe(200);
    expect(policy!.maxDelayMs).toBe(10_000);
  });
});

