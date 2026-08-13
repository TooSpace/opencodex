import { describe, expect, test } from "bun:test";
import {
  deriveComboToolDiscoveryMode,
  resolveRoutedToolDiscoveryMode,
} from "../src/codex/catalog/tool-discovery";

const provider = {
  adapter: "openai-chat",
  baseUrl: "https://example.invalid/v1",
} as const;

describe("routed tool discovery resolver", () => {
  test("preserves PR #1596 as the non-Cursor default", () => {
    expect(resolveRoutedToolDiscoveryMode("external", provider, "model")).toMatchObject({
      mode: "deferred",
      source: "default",
      configured: "auto",
    });
  });

  test("model override wins provider override", () => {
    expect(resolveRoutedToolDiscoveryMode("external", {
      ...provider,
      routedToolDiscovery: "direct",
      modelRoutedToolDiscovery: { model: "deferred" },
    }, "model")).toMatchObject({ mode: "deferred", source: "model-override" });
  });

  test("direct model override is scoped", () => {
    const configured = {
      ...provider,
      routedToolDiscovery: "deferred" as const,
      modelRoutedToolDiscovery: { broken: "direct" as const },
    };
    expect(resolveRoutedToolDiscoveryMode("external", configured, "broken").mode).toBe("direct");
    expect(resolveRoutedToolDiscoveryMode("external", configured, "sibling").mode).toBe("deferred");
  });

  test("Cursor is hard-fenced even when deferred is configured", () => {
    expect(resolveRoutedToolDiscoveryMode("custom", {
      ...provider,
      adapter: "cursor",
      routedToolDiscovery: "deferred",
    }, "auto")).toMatchObject({
      mode: "direct",
      source: "cursor-hard-fence",
    });
  });

  test("combo direct member wins", () => {
    expect(deriveComboToolDiscoveryMode(["deferred", "direct"])).toBe("direct");
    expect(deriveComboToolDiscoveryMode(["deferred", "deferred"])).toBe("deferred");
  });
});
