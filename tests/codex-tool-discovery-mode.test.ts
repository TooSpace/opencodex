import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyProviderConfigHints, buildCatalogEntries, normalizeRoutedCatalogEntry } from "../src/codex/catalog";
import { gatherRoutedModels } from "../src/codex/catalog";
import { deriveComboCatalogModel } from "../src/codex/catalog/aggregation";
import type { CatalogModel } from "../src/codex/catalog/parsing";
import {
  deriveComboToolDiscoveryMode,
  isCursorRoute,
  resolveConfiguredRoutedToolDiscoveryMode,
} from "../src/codex/catalog/tool-discovery";
import { clearModelCache } from "../src/codex/model-cache";
import { getConfigPath, loadConfig, saveConfig } from "../src/config";
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
  // Full matrix from devlog 025_combo_policy_tests.md, including the migration rows where a
  // member has not resolved a mode yet.
  it("is conservative: one direct member forces the combo direct", () => {
    expect(deriveComboToolDiscoveryMode(["deferred", "deferred"])).toBe("deferred");
    expect(deriveComboToolDiscoveryMode(["deferred", "direct"])).toBe("direct");
    expect(deriveComboToolDiscoveryMode(["direct", "direct"])).toBe("direct");
    expect(deriveComboToolDiscoveryMode([undefined, "deferred"])).toBe("deferred");
    expect(deriveComboToolDiscoveryMode([undefined, "direct"])).toBe("direct");
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

  it("covers the remaining member compositions", () => {
    // 025_combo_policy_tests.md: a single direct member must dominate regardless of position
    // or arity, and an unknown member must not be read as direct.
    expect(deriveComboToolDiscoveryMode(["direct", "deferred"])).toBe("direct");
    expect(deriveComboToolDiscoveryMode(["deferred", "deferred", "direct"])).toBe("direct");
    expect(deriveComboToolDiscoveryMode(["direct", "direct"])).toBe("direct");
    expect(deriveComboToolDiscoveryMode(["deferred", undefined])).toBe("deferred");
    expect(deriveComboToolDiscoveryMode([undefined, "direct"])).toBe("direct");
    expect(deriveComboToolDiscoveryMode(["direct"])).toBe("direct");
  });

  it("omits the field entirely for an all-deferred combo", () => {
    // Emitting it unconditionally broke codex-catalog's combo-shape assertion during
    // development; an all-deferred combo must stay byte-identical to the pre-override shape.
    const combo = deriveComboCatalogModel(
      "combo/plain",
      { targets: [{ provider: "p1", model: "a" }, { provider: "p2", model: "b" }], strategy: "failover" } as never,
      [
        { id: "a", provider: "p1", contextWindow: 200_000, toolDiscoveryMode: "deferred" },
        { id: "b", provider: "p2", contextWindow: 200_000, toolDiscoveryMode: "deferred" },
      ],
    );
    expect(combo).not.toHaveProperty("toolDiscoveryMode");
  });

  // 025 alias coverage: the policy must survive every combo alias SHAPE, because the alias
  // is what Codex sees and a shape-dependent policy is the class of defect the unified
  // Cursor fence already had to fix once.
  it("carries a direct combo policy through every alias shape", () => {
    const members: CatalogModel[] = [
      { id: "a", provider: "p1", contextWindow: 200_000, maxInputTokens: 200_000, inputModalities: ["text"], toolDiscoveryMode: "deferred" },
      { id: "b", provider: "p2", contextWindow: 200_000, maxInputTokens: 200_000, inputModalities: ["text"], toolDiscoveryMode: "direct" },
    ];
    const targets = [{ provider: "p1", model: "a" }, { provider: "p2", model: "b" }];

    for (const alias of [undefined, "bare-combo", "vendor/slashed-combo"]) {
      const combo = deriveComboCatalogModel(
        "mixed",
        { targets, strategy: "failover", ...(alias ? { alias } : {}) } as never,
        members,
      );
      expect(combo?.toolDiscoveryMode).toBe("direct");
      // The derived model must CARRY the alias; re-attaching it here would let a broken
      // derivation pass, which is exactly how an earlier revision of this test fooled itself.
      expect(combo?.alias).toBe(alias as never);

      const slug = alias ?? "combo/mixed";
      const rows = buildCatalogEntries(null, [], [combo!], undefined, false, "default", new Set(alias ? [alias] : []));
      // No `?? rows[0]` fallback: the row must exist at the EXACT expected slug, or the
      // alias shape is not actually being exercised.
      const row = rows.find(entry => entry.slug === slug);
      expect(row).toBeDefined();
      expect(row!.slug).toBe(slug);
      expect(row!.supports_search_tool).toBe(false);
      // Hosted search stays independent of the discovery policy on every shape.
      expect(row!.web_search_tool_type).toBe("text_and_image");
      expect(row!.tool_mode).toBe("code_mode_only");
    }
  });

  it("carries a direct combo policy through an explicit native alias", () => {
    const combo = deriveComboCatalogModel(
      "mixed",
      { targets: [{ provider: "p1", model: "a" }, { provider: "p2", model: "b" }], strategy: "failover", alias: "gpt-5.6-sol", nativeAlias: true } as never,
      [
        { id: "a", provider: "p1", contextWindow: 200_000, toolDiscoveryMode: "deferred" },
        { id: "b", provider: "p2", contextWindow: 200_000, toolDiscoveryMode: "direct" },
      ],
    );
    expect(combo?.toolDiscoveryMode).toBe("direct");
    expect(combo?.alias).toBe("gpt-5.6-sol");
    expect(combo?.nativeAlias).toBe(true);

    const rows = buildCatalogEntries(null, [], [combo!], undefined, false, "default", new Set(["gpt-5.6-sol"]));
    const row = rows.find(entry => entry.slug === "gpt-5.6-sol");
    expect(row).toBeDefined();
    // A combo that takes over a native slug is still a ROUTED row and must carry the
    // resolved policy rather than inheriting native catalog defaults.
    expect(row!.supports_search_tool).toBe(false);
    expect(row!.tool_mode).toBe("code_mode_only");
  });
});

describe("routed tool-discovery backward compatibility", () => {
  // 023_backward_compatibility_tests.md: the load-bearing promise of this feature is that an
  // unconfigured tree is unchanged. Assert the WHOLE emitted row, not just the two policy
  // fields, so an unrelated key silently appearing on routed rows also fails here.
  it("emits identical rows whether the deferred default is implicit or explicit", () => {
    const withoutPolicy = buildCatalogEntries(null, [], [{ provider: "deepseek", id: "glm-5.2" }]);
    const withExplicitAuto = buildCatalogEntries(null, [], [
      { provider: "deepseek", id: "glm-5.2", toolDiscoveryMode: "deferred" },
    ]);
    expect(JSON.stringify(withExplicitAuto)).toBe(JSON.stringify(withoutPolicy));
  });

  // Comparing two rows built by the same path cannot catch a key that leaks onto BOTH, so
  // the key set is pinned absolutely and any new catalog field must be added here
  // deliberately. Ablation-verified: injecting a stray field into the template-less branch
  // fails this, and injecting one into normalizeRoutedCatalogEntry fails the template case.
  const EXPECTED_ROUTED_KEYS = [
    "apply_patch_tool_type",
    "auto_compact_token_limit",
    "base_instructions",
    "comp_hash",
    "context_window",
    "default_reasoning_level",
    "default_reasoning_summary",
    "default_verbosity",
    "description",
    "display_name",
    "effective_context_window_percent",
    "experimental_supported_tools",
    "input_modalities",
    "max_context_window",
    "priority",
    "shell_type",
    "slug",
    "support_verbosity",
    "supported_in_api",
    "supported_reasoning_levels",
    "supports_image_detail_original",
    "supports_parallel_tool_calls",
    "supports_reasoning_summaries",
    "supports_search_tool",
    "tool_mode",
    "truncation_policy",
    "visibility",
    "web_search_tool_type",
  ];

  it("pins the exact emitted key set on the template-less path", () => {
    const rows = buildCatalogEntries(null, [], [{ provider: "deepseek", id: "glm-5.2" }]);
    const routed = rows.find(entry => entry.slug === "deepseek/glm-5.2");
    expect(Object.keys(routed ?? {}).sort()).toEqual(EXPECTED_ROUTED_KEYS);
  });

  it("pins the exact emitted key set on the template path", () => {
    // The template path runs normalizeRoutedCatalogEntry, which the fallback never calls, so
    // it needs its own guard. This is an ABSOLUTE key set rather than a list of forbidden
    // names: an earlier version only rejected the three policy fields plus one sentinel, so
    // a stray field under any other name passed straight through it.
    const normalized = normalizeRoutedCatalogEntry({ slug: "deepseek/glm-5.2" } as never, false, {
      toolDiscoveryMode: "direct",
      providerId: "deepseek",
      cursorRoute: false,
    }) as Record<string, unknown>;
    expect(Object.keys(normalized).sort()).toEqual([
      "apply_patch_tool_type",
      "auto_compact_token_limit",
      "comp_hash",
      "context_window",
      "default_reasoning_summary",
      "default_verbosity",
      "effective_context_window_percent",
      "experimental_supported_tools",
      "input_modalities",
      "max_context_window",
      "slug",
      "support_verbosity",
      "supports_image_detail_original",
      "supports_parallel_tool_calls",
      "supports_reasoning_summaries",
      "supports_search_tool",
      "tool_mode",
      "truncation_policy",
      "web_search_tool_type",
    ]);
  });

  it("keeps the Cursor row shape unchanged with zero configuration", () => {
    const rows = buildCatalogEntries(null, [], [{ provider: "cursor", id: "gpt-5.5" }]);
    const cursor = rows.find(entry => entry.slug === "cursor/gpt-5.5");
    expect(cursor?.supports_search_tool).toBe(false);
    expect(cursor).not.toHaveProperty("web_search_tool_type");
    // The catalog must never carry the opencodex-only internal field.
    expect(cursor).not.toHaveProperty("tool_discovery_mode");
    expect(cursor).not.toHaveProperty("toolDiscoveryMode");
  });

  // These drive the REAL on-disk round trip (loadConfig/saveConfig against a temp
  // OPENCODEX_HOME), not just validateConfigCandidate. Validating a candidate object cannot
  // prove the file-level promises in 023: that a pre-field config gains nothing on read, and
  // that an unrelated save preserves fields a newer binary wrote.
  function withTempHome<T>(run: () => T): T {
    const previous = process.env.OPENCODEX_HOME;
    const home = mkdtempSync(join(tmpdir(), "ocx-tool-discovery-compat-"));
    process.env.OPENCODEX_HOME = home;
    try { return run(); }
    finally {
      if (previous === undefined) delete process.env.OPENCODEX_HOME;
      else process.env.OPENCODEX_HOME = previous;
      rmSync(home, { recursive: true, force: true });
    }
  }

  it("warns instead of silently degrading a malformed policy on load", () => {
    // 020: the load path is tolerant on purpose, but an operator whose emergency escape
    // hatch was dropped by a typo must be told — silence would repeat the #1529
    // observability failure at smaller scope.
    withTempHome(() => {
      const base = {
        port: 10100,
        defaultProvider: "test",
        providers: {
          test: {
            adapter: "openai-chat",
            baseUrl: "http://127.0.0.1:1/v1",
            apiKey: "k",
            allowPrivateNetwork: true,
            routedToolDiscovery: "eager",
            modelRoutedToolDiscovery: { "glm-5.2": "nope" },
          },
        },
      };
      saveConfig(base as never);
      writeFileSync(getConfigPath(), `${JSON.stringify(base, null, 2)}\n`);

      const warnings: string[] = [];
      const original = console.warn;
      console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(" ")); };
      let loaded;
      try { loaded = loadConfig(); }
      finally { console.warn = original; }

      // Degraded, not fatal: the provider and its credential survive.
      const provider = loaded.providers.test as unknown as Record<string, unknown>;
      expect(provider.apiKey).toBe("k");
      expect(provider.routedToolDiscovery).toBeUndefined();
      expect(provider.modelRoutedToolDiscovery).toBeUndefined();

      const joined = warnings.join("\n");
      expect(joined).toContain("routedToolDiscovery");
      expect(joined).toContain("modelRoutedToolDiscovery");
      // Never echo the offending value; provider config can hold secrets.
      expect(joined).not.toContain("eager");
      expect(joined).not.toContain("nope");
    });
  });

  it("warns when a blank model key silently drops the whole map on load", () => {
    // `z.string().min(1)` rejects the key and takes the entire map with it, so a
    // value-only warning would let the map vanish without a word.
    withTempHome(() => {
      const base = {
        port: 10100,
        defaultProvider: "test",
        providers: {
          test: {
            adapter: "openai-chat",
            baseUrl: "http://127.0.0.1:1/v1",
            apiKey: "k",
            allowPrivateNetwork: true,
            // Whitespace-only, not just empty: `.min(1)` would accept "   " while the write
            // boundary rejects it as blank, so the warning would claim a drop that never happened.
            modelRoutedToolDiscovery: { "   ": "direct" },
          },
        },
      };
      saveConfig(base as never);
      writeFileSync(getConfigPath(), `${JSON.stringify(base, null, 2)}\n`);

      const warnings: string[] = [];
      const original = console.warn;
      console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(" ")); };
      let loaded;
      try { loaded = loadConfig(); }
      finally { console.warn = original; }

      const provider = loaded.providers.test as unknown as Record<string, unknown>;
      expect(provider.apiKey).toBe("k");
      expect(provider.modelRoutedToolDiscovery).toBeUndefined();
      const joined = warnings.join("\n");
      expect(joined).toContain("modelRoutedToolDiscovery");
      expect(joined).toContain("blank model key");
    });
  });

  it("does not materialize the new fields when loading a pre-field config file", () => {
    withTempHome(() => {
      // A config written before these fields existed. A materialized default here would
      // rewrite every existing user's file on their next unrelated save.
      const legacy = {
        port: 10100,
        defaultProvider: "test",
        providers: {
          test: { adapter: "openai-chat", baseUrl: "http://127.0.0.1:1/v1", apiKey: "k", allowPrivateNetwork: true },
        },
      };
      saveConfig(legacy as never);
      writeFileSync(getConfigPath(), `${JSON.stringify(legacy, null, 2)}\n`);

      const loaded = loadConfig();
      const provider = loaded.providers.test as unknown as Record<string, unknown>;
      expect(Object.hasOwn(provider, "routedToolDiscovery")).toBe(false);
      expect(Object.hasOwn(provider, "modelRoutedToolDiscovery")).toBe(false);

      // A no-op read followed by an unrelated save must not introduce them either.
      saveConfig({ ...loaded, port: 10101 } as never);
      const onDisk = JSON.parse(readFileSync(getConfigPath(), "utf8")) as Record<string, never>;
      const savedProvider = (onDisk.providers as Record<string, Record<string, unknown>>).test;
      expect(Object.hasOwn(savedProvider, "routedToolDiscovery")).toBe(false);
      expect(Object.hasOwn(savedProvider, "modelRoutedToolDiscovery")).toBe(false);
    });
  });

  it("preserves the fields through an unrelated save, the downgrade contract", () => {
    withTempHome(() => {
      // Written on disk as UNKNOWN provider keys — the shape an older binary sees. The
      // schema is .passthrough(), so an unrelated save must carry them through rather than
      // dropping a newer operator's escape hatch.
      const configured = {
        port: 10100,
        defaultProvider: "test",
        providers: {
          test: {
            adapter: "openai-chat",
            baseUrl: "http://127.0.0.1:1/v1",
            apiKey: "k",
            allowPrivateNetwork: true,
            routedToolDiscovery: "direct",
            modelRoutedToolDiscovery: { "glm-5.2": "deferred" },
          },
        },
      };
      saveConfig(configured as never);
      writeFileSync(getConfigPath(), `${JSON.stringify(configured, null, 2)}\n`);

      const loaded = loadConfig();
      saveConfig({ ...loaded, port: 10102 } as never);

      const onDisk = JSON.parse(readFileSync(getConfigPath(), "utf8")) as Record<string, never>;
      const savedProvider = (onDisk.providers as Record<string, Record<string, unknown>>).test;
      expect(savedProvider.routedToolDiscovery).toBe("direct");
      expect(savedProvider.modelRoutedToolDiscovery).toEqual({ "glm-5.2": "deferred" });
    });
  });

  it("never serializes the internal policy field onto a routed row", () => {
    const rows = buildCatalogEntries(null, [], [
      { provider: "deepseek", id: "glm-5.2", toolDiscoveryMode: "direct", cursorRoute: false },
    ]);
    const routed = rows.find(entry => entry.slug === "deepseek/glm-5.2");
    expect(routed).not.toHaveProperty("toolDiscoveryMode");
    expect(routed).not.toHaveProperty("tool_discovery_mode");
    expect(routed).not.toHaveProperty("cursorRoute");
  });
});

describe("routed tool-discovery gather identity", () => {
  // Ablation matrix (run 2026-08-13), so nobody has to guess what these pin:
  //   remove rtd/mrtd from providerCatalogFingerprint ............ still green
  //   neutralize discoveryPolicyIdentity ......................... still green
  //   neutralize providerGraphIdentity ........................... still green
  //   neutralize ALL THREE ....................................... 2 of 3 FAIL
  // So these are not vacuous — they detect a real flight collision — but no single
  // mechanism is what they pin, because the three are redundant by design. The
  // fingerprint fields are kept as defense in depth: it is an explicit allow-list whose
  // omissions leaked flights twice before (credentials, then reasoningEfforts, both
  // reproduced against real routes), and its correctness is NOT what these prove.
  function liveGatherConfig(
    fetchImpl: typeof globalThis.fetch,
    routedToolDiscovery?: "auto" | "deferred" | "direct",
    modelRoutedToolDiscovery?: Record<string, "auto" | "deferred" | "direct">,
  ): never {
    return {
      defaultProvider: "tdlab",
      providers: {
        tdlab: {
          adapter: "openai-chat",
          baseUrl: "http://127.0.0.1:59117/v1",
          apiKey: "sk-test",
          liveModels: true,
          // Caller-owned transport executor: the supported injection point (it is excluded
          // from provider-graph identity as non-admitted state).
          fetch: fetchImpl,
          // Keeps the gather hermetic: the destination policy resolves real DNS and
          // fail-closes on an unresolvable host, which would short-circuit before the
          // latched fetch is ever entered.
          allowPrivateNetwork: true,
          ...(routedToolDiscovery ? { routedToolDiscovery } : {}),
          ...(modelRoutedToolDiscovery ? { modelRoutedToolDiscovery } : {}),
        },
      },
    } as never;
  }

  // A sequential pair cannot observe flight REUSE at all: a completed flight is removed from
  // gatherInflight in its finally block, so two wholly independent gathers also compare
  // equal. Observing the join needs real concurrency plus a way to count upstream discovery.
  function latchedFetch(): { fetch: typeof globalThis.fetch; release: () => void; calls: () => number } {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const impl = (async () => {
      calls += 1;
      await gate;
      return new Response(
        JSON.stringify({ data: [{ id: "glm-5.2" }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof globalThis.fetch;
    return { fetch: impl, release, calls: () => calls };
  }

  function mode(models: CatalogModel[]): string | undefined {
    return models.find(model => model.id === "glm-5.2")?.toolDiscoveryMode;
  }

  it("joins one flight for an identical policy but splits for a different one", async () => {
    clearModelCache("tdlab");
    const same = latchedFetch();
    const joined = Promise.all([
      gatherRoutedModels(liveGatherConfig(same.fetch, "direct")),
      gatherRoutedModels(liveGatherConfig(same.fetch, "direct")),
    ]);
    same.release();
    const [first, second] = await joined;
    // One upstream discovery for two concurrent identical-policy callers: they joined.
    expect(same.calls()).toBe(1);
    expect(mode(first)).toBe("direct");
    expect(second).toEqual(first);

    clearModelCache("tdlab");
    const split = latchedFetch();
    const separate = Promise.all([
      gatherRoutedModels(liveGatherConfig(split.fetch, "deferred")),
      gatherRoutedModels(liveGatherConfig(split.fetch, "direct")),
    ]);
    split.release();
    const [asDeferred, asDirect] = await separate;
    // Two flights: joining would serve one config the other's catalog.
    expect(split.calls()).toBe(2);
    expect(mode(asDeferred)).toBe("deferred");
    expect(mode(asDirect)).toBe("direct");
  });

  it("splits concurrent flights that differ only in the per-model map", async () => {
    clearModelCache("tdlab");
    const split = latchedFetch();
    const both = Promise.all([
      gatherRoutedModels(liveGatherConfig(split.fetch, undefined, { "glm-5.2": "direct" })),
      gatherRoutedModels(liveGatherConfig(split.fetch, undefined, { "glm-5.2": "deferred" })),
    ]);
    split.release();
    const [direct, deferred] = await both;
    expect(split.calls()).toBe(2);
    expect(mode(direct)).toBe("direct");
    expect(mode(deferred)).toBe("deferred");
  });

  it("re-resolves the policy against a warm model cache", async () => {
    clearModelCache("tdlab");
    const warm = latchedFetch();
    const first = gatherRoutedModels(liveGatherConfig(warm.fetch, "deferred"));
    warm.release();
    expect(mode(await first)).toBe("deferred");

    // The model list may now come from the warm cache, but the POLICY must be re-resolved
    // from the current config rather than inherited from the cached gather.
    expect(mode(await gatherRoutedModels(liveGatherConfig(warm.fetch, "direct")))).toBe("direct");
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
