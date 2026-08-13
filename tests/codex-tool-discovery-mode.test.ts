import { describe, expect, it } from "bun:test";
import { applyProviderConfigHints, buildCatalogEntries, normalizeRoutedCatalogEntry } from "../src/codex/catalog";
import { deriveComboCatalogModel } from "../src/codex/catalog/aggregation";
import type { CatalogModel } from "../src/codex/catalog/parsing";
import {
  deriveComboToolDiscoveryMode,
  isCursorRoute,
  resolveConfiguredRoutedToolDiscoveryMode,
} from "../src/codex/catalog/tool-discovery";
import { validateConfigCandidate } from "../src/config";
import type { OcxProviderConfig } from "../src/types";

function provider(extra: Partial<OcxProviderConfig> = {}): OcxProviderConfig {
  return { adapter: "openai-responses", baseUrl: "https://example.invalid", ...extra } as OcxProviderConfig;
}

function model(id: string, providerName: string): CatalogModel {
  return { id, provider: providerName };
}

describe("routed tool-discovery resolution", () => {
  // The precedence table from devlog/_plan/260813_routed_tool_discovery_profiles/011.
  const cases: Array<{
    label: string;
    prov: OcxProviderConfig;
    expected: "deferred" | "direct";
    source: string;
  }> = [
    { label: "unset provider, unset model", prov: provider(), expected: "deferred", source: "default" },
    { label: "provider auto", prov: provider({ routedToolDiscovery: "auto" }), expected: "deferred", source: "provider-override" },
    { label: "provider direct", prov: provider({ routedToolDiscovery: "direct" }), expected: "direct", source: "provider-override" },
    {
      label: "provider direct, model deferred",
      prov: provider({ routedToolDiscovery: "direct", modelRoutedToolDiscovery: { "glm-5.2": "deferred" } }),
      expected: "deferred",
      source: "model-override",
    },
    {
      label: "provider deferred, model direct",
      prov: provider({ routedToolDiscovery: "deferred", modelRoutedToolDiscovery: { "glm-5.2": "direct" } }),
      expected: "direct",
      source: "model-override",
    },
    {
      label: "provider deferred, model auto",
      prov: provider({ routedToolDiscovery: "deferred", modelRoutedToolDiscovery: { "glm-5.2": "auto" } }),
      expected: "deferred",
      source: "model-override",
    },
  ];

  for (const testCase of cases) {
    it(`resolves ${testCase.label} to ${testCase.expected}`, () => {
      const resolved = resolveConfiguredRoutedToolDiscoveryMode("deepseek", testCase.prov, "glm-5.2");
      expect(resolved.mode).toBe(testCase.expected);
      expect(resolved.source).toBe(testCase.source as never);
    });
  }

  it("keeps Cursor direct even when explicitly configured deferred, and says so", () => {
    const resolved = resolveConfiguredRoutedToolDiscoveryMode(
      "cursor",
      provider({ adapter: "cursor", routedToolDiscovery: "deferred" }),
      "gpt-5.5",
    );
    expect(resolved.mode).toBe("direct");
    expect(resolved.source).toBe("cursor-hard-fence");
    // Silent acceptance is not allowed (INV-4): the ignored configuration must surface.
    expect(resolved.warning).toContain("ignored for Cursor");
  });

  it("fences Cursor by adapter even when the provider is named differently", () => {
    const resolved = resolveConfiguredRoutedToolDiscoveryMode("my-cursor-gateway", provider({ adapter: "cursor" }), "gpt-5.5");
    expect(resolved.mode).toBe("direct");
    expect(resolved.source).toBe("cursor-hard-fence");
  });

  it("warns when a non-Cursor route opts into direct discovery", () => {
    const resolved = resolveConfiguredRoutedToolDiscoveryMode("deepseek", provider({ routedToolDiscovery: "direct" }), "glm-5.2");
    expect(resolved.warning).toContain("full MCP declarations");
  });

  it("matches model keys with modelRecordValue semantics but not dated variants", () => {
    const prov = provider({ modelRoutedToolDiscovery: { "glm-5.2": "direct" } });
    expect(resolveConfiguredRoutedToolDiscoveryMode("deepseek", prov, "glm-5.2").mode).toBe("direct");
    expect(resolveConfiguredRoutedToolDiscoveryMode("deepseek", prov, "GLM-5.2").mode).toBe("direct");
    expect(resolveConfiguredRoutedToolDiscoveryMode("deepseek", prov, "glm-5.2:free").mode).toBe("direct");
    // Dated variants are deliberately NOT matched — name the exact failing model id.
    expect(resolveConfiguredRoutedToolDiscoveryMode("deepseek", prov, "glm-5.2-20260813").mode).toBe("deferred");
  });
});

describe("routed tool-discovery catalog emission", () => {
  it("defaults to the PR #1596 shape with no configuration", () => {
    const entry = normalizeRoutedCatalogEntry({ slug: "deepseek/glm-5.2" } as never) as Record<string, unknown>;
    expect(entry.supports_search_tool).toBe(true);
    expect(entry.web_search_tool_type).toBe("text_and_image");
    expect(entry.tool_mode).toBe("code_mode_only");
  });

  it("emits direct discovery when the resolved mode says so", () => {
    const entry = normalizeRoutedCatalogEntry({ slug: "deepseek/glm-5.2" } as never, false, {
      toolDiscoveryMode: "direct",
      providerId: "deepseek",
    }) as Record<string, unknown>;
    expect(entry.supports_search_tool).toBe(false);
    // INV-3: hosted web search is a separate capability and must survive direct mode.
    expect(entry.web_search_tool_type).toBe("text_and_image");
    expect(entry.tool_mode).toBe("code_mode_only");
  });

  it("ignores a deferred mode for Cursor rows", () => {
    const entry = normalizeRoutedCatalogEntry({ slug: "cursor/gpt-5.5" } as never, false, {
      toolDiscoveryMode: "deferred",
      providerId: "cursor",
    }) as Record<string, unknown>;
    expect(entry.supports_search_tool).toBe(false);
    expect(entry.web_search_tool_type).toBeUndefined();
  });

  it("classifies a cursor/-aliased combo by provider identity, not by its public slug", () => {
    // The unresolved #1596 P2: the template path fenced on the slug while the template-less
    // path fenced on provider identity, so this row's discovery mode depended on whether a
    // template happened to exist. Both paths now share isCursorRoute(), which UNIONS the
    // signals — reconciling them must never unfence a row that one path used to fence, since
    // an under-fenced Cursor row advertises a surface its transport cannot serve.
    expect(isCursorRoute("cursor/gpt-5.5", { providerId: "combo" })).toBe(true);
    expect(isCursorRoute("cursor/gpt-5.5", { providerId: "cursor" })).toBe(true);
    expect(isCursorRoute("combo/mix", { cursorRoute: true })).toBe(true);
    // No CatalogModel available: the slug prefix remains the only signal.
    expect(isCursorRoute("cursor/gpt-5.5")).toBe(true);
    expect(isCursorRoute("deepseek/glm-5.2")).toBe(false);
    expect(isCursorRoute("deepseek/glm-5.2", { providerId: "deepseek" })).toBe(false);

    // Byte-identical to the pre-change template path for this row.
    const entry = normalizeRoutedCatalogEntry({ slug: "cursor/gpt-5.5" } as never, false, {
      toolDiscoveryMode: "deferred",
      providerId: "combo",
    }) as Record<string, unknown>;
    expect(entry.supports_search_tool).toBe(false);
    expect(entry.web_search_tool_type).toBeUndefined();
  });

  it("fences a Cursor-adapter gateway published under a custom provider name", () => {
    // Only the resolver sees the adapter, so it stamps CatalogModel.cursorRoute and
    // serialization honors it. Without that hop the row would keep hosted-search metadata
    // while the resolver had already hard-fenced it to direct.
    const resolved = resolveConfiguredRoutedToolDiscoveryMode("my-gw", provider({ adapter: "cursor" }), "gpt-5.5");
    expect(resolved.mode).toBe("direct");

    const entry = normalizeRoutedCatalogEntry({ slug: "my-gw/gpt-5.5" } as never, false, {
      toolDiscoveryMode: resolved.mode,
      providerId: "my-gw",
      cursorRoute: true,
    }) as Record<string, unknown>;
    expect(entry.supports_search_tool).toBe(false);
    expect(entry.web_search_tool_type).toBeUndefined();
    expect(entry.supports_parallel_tool_calls).toBe(true);
  });

  it("stamps cursorRoute on the CatalogModel for a Cursor-adapter gateway", () => {
    const hinted = applyProviderConfigHints("my-gw", provider({ adapter: "cursor" }), model("gpt-5.5", "my-gw"));
    expect(hinted.cursorRoute).toBe(true);
    expect(hinted.toolDiscoveryMode).toBe("direct");
    // A plain provider must not gain the marker.
    expect(applyProviderConfigHints("deepseek", provider(), model("glm-5.2", "deepseek")).cursorRoute).toBeUndefined();
  });
});

describe("routed tool-discovery propagation", () => {
  // These drive the REAL construction paths in sync.ts rather than calling normalization
  // directly, so the template-less fallback branch and its ensureStrictCatalogFields
  // interaction are actually covered.
  it("carries a direct override through the template-less fallback path", () => {
    const entries = buildCatalogEntries(null, [], [
      { provider: "deepseek", id: "glm-5.2", toolDiscoveryMode: "direct" },
    ]);
    const routed = entries.find(entry => entry.slug === "deepseek/glm-5.2");
    expect(routed?.supports_search_tool).toBe(false);
    // Hosted search is a separate capability and survives direct mode.
    expect(routed?.web_search_tool_type).toBe("text_and_image");
    expect(routed?.tool_mode).toBe("code_mode_only");
  });

  it("keeps the fallback path on deferred with no configuration", () => {
    const entries = buildCatalogEntries(null, [], [{ provider: "deepseek", id: "glm-5.2" }]);
    const routed = entries.find(entry => entry.slug === "deepseek/glm-5.2");
    expect(routed?.supports_search_tool).toBe(true);
    expect(routed?.web_search_tool_type).toBe("text_and_image");
  });

  it("fences a Cursor-adapter gateway on the fallback path via cursorRoute", () => {
    const entries = buildCatalogEntries(null, [], [
      { provider: "my-gw", id: "gpt-5.5", toolDiscoveryMode: "direct", cursorRoute: true },
    ]);
    const routed = entries.find(entry => entry.slug === "my-gw/gpt-5.5");
    expect(routed?.supports_search_tool).toBe(false);
    expect(routed?.web_search_tool_type).toBeUndefined();
  });

  it("carries the resolved mode onto the CatalogModel", () => {
    const hinted = applyProviderConfigHints("deepseek", provider({ routedToolDiscovery: "direct" }), model("glm-5.2", "deepseek"));
    expect(hinted.toolDiscoveryMode).toBe("direct");
  });

  it("leaves an unconfigured provider on deferred", () => {
    const hinted = applyProviderConfigHints("deepseek", provider(), model("glm-5.2", "deepseek"));
    expect(hinted.toolDiscoveryMode).toBe("deferred");
  });

  it("changes only the targeted model on a mixed gateway", () => {
    const prov = provider({ modelRoutedToolDiscovery: { "glm-5.2": "direct" } });
    expect(applyProviderConfigHints("gateway", prov, model("glm-5.2", "gateway")).toolDiscoveryMode).toBe("direct");
    expect(applyProviderConfigHints("gateway", prov, model("kimi-k3", "gateway")).toolDiscoveryMode).toBe("deferred");
  });
});

describe("combo tool-discovery derivation", () => {
  it("is conservative: one direct member forces the combo direct", () => {
    expect(deriveComboToolDiscoveryMode(["deferred", "deferred"])).toBe("deferred");
    expect(deriveComboToolDiscoveryMode(["deferred", "direct"])).toBe("direct");
    expect(deriveComboToolDiscoveryMode([undefined, undefined])).toBe("deferred");
    expect(deriveComboToolDiscoveryMode([])).toBe("deferred");
  });

  it("propagates the conservative mode through deriveComboCatalogModel", () => {
    const members: CatalogModel[] = [
      { id: "a", provider: "p1", contextWindow: 200_000, toolDiscoveryMode: "deferred" },
      { id: "b", provider: "p2", contextWindow: 200_000, toolDiscoveryMode: "direct" },
    ];
    const combo = deriveComboCatalogModel(
      "combo/mix",
      { targets: [{ provider: "p1", model: "a" }, { provider: "p2", model: "b" }], strategy: "failover" } as never,
      members,
    );
    expect(combo?.toolDiscoveryMode).toBe("direct");
  });
});

describe("routed tool-discovery config admission", () => {
  // defaultProvider must resolve, otherwise every candidate fails on an unrelated rule.
  function candidate(providerPatch: Record<string, unknown>): Record<string, unknown> {
    return {
      defaultProvider: "deepseek",
      providers: { deepseek: { adapter: "openai-responses", baseUrl: "https://example.invalid", ...providerPatch } },
    };
  }

  it("accepts every valid mode", () => {
    for (const mode of ["auto", "deferred", "direct"]) {
      expect(validateConfigCandidate(candidate({ routedToolDiscovery: mode })).ok).toBe(true);
      expect(validateConfigCandidate(candidate({ modelRoutedToolDiscovery: { "glm-5.2": mode } })).ok).toBe(true);
    }
  });

  it("rejects an unknown provider-level mode with a path-specific error", () => {
    const result = validateConfigCandidate(candidate({ routedToolDiscovery: "eager" }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejection");
    expect(result.error).toBe("schema_invalid: providers.deepseek.routedToolDiscovery: must be auto, deferred, or direct");
  });

  it("rejects an unknown model-level mode naming the model", () => {
    const result = validateConfigCandidate(candidate({ modelRoutedToolDiscovery: { "glm-5.2": "eager" } }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejection");
    expect(result.error).toBe("schema_invalid: providers.deepseek.modelRoutedToolDiscovery.glm-5.2: must be auto, deferred, or direct");
  });

  it("rejects a non-object model map and a blank model key", () => {
    expect(validateConfigCandidate(candidate({ modelRoutedToolDiscovery: "direct" })).ok).toBe(false);
    expect(validateConfigCandidate(candidate({ modelRoutedToolDiscovery: ["direct"] })).ok).toBe(false);
    expect(validateConfigCandidate(candidate({ modelRoutedToolDiscovery: { "  ": "direct" } })).ok).toBe(false);
  });

  it("rejects an accessor-backed model map without invoking the getter", () => {
    let getterCalls = 0;
    const provider: Record<string, unknown> = { adapter: "openai-responses", baseUrl: "https://example.invalid" };
    Object.defineProperty(provider, "modelRoutedToolDiscovery", {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        return { "glm-5.2": "direct" };
      },
    });
    const result = validateConfigCandidate({ defaultProvider: "deepseek", providers: { deepseek: provider } });
    expect(result.ok).toBe(false);
    // The descriptor check must precede the read, so the getter never runs.
    expect(getterCalls).toBe(0);
  });

  it("rejects an accessor-backed provider-level mode without invoking the getter", () => {
    // An accessor must not be mistaken for an absent field: treating it as absent lets the
    // validator pass and Zod invokes the getter moments later, which is the whole bypass.
    let getterCalls = 0;
    const provider: Record<string, unknown> = { adapter: "openai-responses", baseUrl: "https://example.invalid" };
    Object.defineProperty(provider, "routedToolDiscovery", {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        return "direct";
      },
    });
    const result = validateConfigCandidate({ defaultProvider: "deepseek", providers: { deepseek: provider } });
    expect(result.ok).toBe(false);
    expect(getterCalls).toBe(0);
  });

  it("rejects an accessor-backed provider entry and an accessor providers map", () => {
    let entryCalls = 0;
    const providers: Record<string, unknown> = {};
    Object.defineProperty(providers, "deepseek", {
      enumerable: true,
      configurable: true,
      get() {
        entryCalls += 1;
        return { adapter: "openai-responses", baseUrl: "https://example.invalid", routedToolDiscovery: "direct" };
      },
    });
    expect(validateConfigCandidate({ defaultProvider: "deepseek", providers }).ok).toBe(false);
    expect(entryCalls).toBe(0);

    let mapCalls = 0;
    const root: Record<string, unknown> = { defaultProvider: "deepseek" };
    Object.defineProperty(root, "providers", {
      enumerable: true,
      configurable: true,
      get() {
        mapCalls += 1;
        return { deepseek: { adapter: "openai-responses", baseUrl: "https://example.invalid" } };
      },
    });
    expect(validateConfigCandidate(root).ok).toBe(false);
    expect(mapCalls).toBe(0);
  });

  it("rejects a prototype-inherited value even when it is otherwise valid", () => {
    // An INVALID inherited value is a weak test: Zod's .catch(undefined) would discard it and
    // the candidate would pass for the wrong reason. A VALID inherited value is the real
    // case — without an explicit check it gets copied into the admitted config.
    const polluted = Object.create({ routedToolDiscovery: "direct" }) as Record<string, unknown>;
    polluted.adapter = "openai-responses";
    polluted.baseUrl = "https://example.invalid";
    expect(validateConfigCandidate({ defaultProvider: "deepseek", providers: { deepseek: polluted } }).ok).toBe(false);
  });

  it("rejects a prototype-inherited getter without invoking it", () => {
    let getterCalls = 0;
    const proto = {};
    Object.defineProperty(proto, "routedToolDiscovery", {
      configurable: true,
      get() {
        getterCalls += 1;
        return "direct";
      },
    });
    const polluted = Object.create(proto) as Record<string, unknown>;
    polluted.adapter = "openai-responses";
    polluted.baseUrl = "https://example.invalid";
    const result = validateConfigCandidate({ defaultProvider: "deepseek", providers: { deepseek: polluted } });
    expect(result.ok).toBe(false);
    // `in` walks the prototype chain without reading, so the getter must never run.
    expect(getterCalls).toBe(0);
  });

  it("rejects an inherited providers map without invoking its getter", () => {
    let getterCalls = 0;
    const proto = {};
    Object.defineProperty(proto, "providers", {
      configurable: true,
      get() {
        getterCalls += 1;
        return { deepseek: { adapter: "openai-responses", baseUrl: "https://example.invalid" } };
      },
    });
    const root = Object.create(proto) as Record<string, unknown>;
    root.defaultProvider = "deepseek";
    expect(validateConfigCandidate(root).ok).toBe(false);
    expect(getterCalls).toBe(0);
  });
});
