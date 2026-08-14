import { describe, expect, test } from "bun:test";
import {
  buildCatalogEntriesFromObservedState,
  effectiveSubagentRoster,
  MAX_SPAWN_AGENT_MODEL_OVERRIDES,
} from "../src/codex/catalog/sync";
import type { CatalogModel } from "../src/types";

// #1649: config.modelPickerOrder assigns a deterministic priority band to non-featured routed
// rows so a catalog with more than 5 routed models keeps a stable picker order across rebuilds,
// independent of the 5-slot subagentModels spawn_agent cap.

function template(): Record<string, unknown> {
  return {
    slug: "gpt-5.5",
    display_name: "gpt-5.5",
    description: "Native GPT model",
    priority: 1,
    visibility: "list",
    tool_mode: "code",
  };
}

const goModels = [
  { id: "glm-5.2", provider: "jd-chat", owned_by: "jd" },
  { id: "kimi-k3", provider: "jd-chat", owned_by: "jd" },
  { id: "deepseek-v4-pro", provider: "tyler", owned_by: "tyler" },
  { id: "sonnet-5", provider: "jd-claude", owned_by: "jd" },
] as unknown as CatalogModel[];

function build(overrides: { featured?: string[]; modelPickerOrder?: string[] }) {
  const entries = buildCatalogEntriesFromObservedState({
    template: template() as never,
    gptSlugs: [],
    goModels,
    featured: overrides.featured,
    modelPickerOrder: overrides.modelPickerOrder,
    wsEnabled: false,
    multiAgentMode: "default",
    exactComboSlugs: new Set(),
    accountSelectors: [],
    suppressedBareNativeSlugs: new Set(),
    disabledNativeAccountSlugs: new Set(),
    multiAgentV2Enabled: false,
  });
  return Object.fromEntries(entries.map(e => {
    const r = e as Record<string, unknown>;
    return [r.slug as string, r.priority as number];
  })) as Record<string, number>;
}

describe("modelPickerOrder (#1649)", () => {
  test("unset leaves every non-featured routed row at the flat default priority", () => {
    const p = build({});
    expect(p["jd-chat/glm-5.2"]).toBe(5);
    expect(p["jd-chat/kimi-k3"]).toBe(5);
    expect(p["tyler/deepseek-v4-pro"]).toBe(5);
    expect(p["jd-claude/sonnet-5"]).toBe(5);
  });

  test("listed rows sort among themselves in declared order, in the high picker tier", () => {
    const p = build({
      modelPickerOrder: [
        "tyler/deepseek-v4-pro",
        "jd-chat/kimi-k3",
        "jd-chat/glm-5.2",
      ],
    });
    // Declared order is honored among the listed rows.
    expect(p["tyler/deepseek-v4-pro"]).toBeLessThan(p["jd-chat/kimi-k3"]);
    expect(p["jd-chat/kimi-k3"]).toBeLessThan(p["jd-chat/glm-5.2"]);
    // Listed rows occupy the high picker tier (>= 1000); an unlisted, non-featured row keeps its
    // default priority (5) and therefore is NOT reordered by modelPickerOrder.
    expect(p["tyler/deepseek-v4-pro"]).toBeGreaterThanOrEqual(1000);
    expect(p["jd-claude/sonnet-5"]).toBe(5);
  });

  test("featured rows keep their top priority ahead of the picker-order band", () => {
    const p = build({
      featured: ["jd-claude/sonnet-5"],
      modelPickerOrder: ["tyler/deepseek-v4-pro", "jd-chat/kimi-k3"],
    });
    // Featured wins outright (priority 0).
    expect(p["jd-claude/sonnet-5"]).toBe(0);
    // Picker-order rows come after the featured band.
    expect(p["tyler/deepseek-v4-pro"]).toBeGreaterThan(p["jd-claude/sonnet-5"]);
    expect(p["tyler/deepseek-v4-pro"]).toBeLessThan(p["jd-chat/kimi-k3"]);
  });

  // Regression for the review on #1666: modelPickerOrder must not change spawn_agent candidate
  // eligibility. spawn_agent takes the first MAX_SPAWN_AGENT_MODEL_OVERRIDES picker rows by
  // ascending priority. The picker-order band lives in the high (>= 1_000) tier, so featured
  // rows (0..N-1) and any default-tier routed rows (priority 5) fill the candidate window first;
  // a row that is ONLY placed by modelPickerOrder does not displace a default-tier candidate.
  test("picker-order-only rows do not displace default-tier spawn_agent candidates", () => {
    const manyRouted = [
      // Not in modelPickerOrder -> stay at default priority 5 -> fill the candidate window.
      { id: "unlisted-a", provider: "jd-chat", owned_by: "jd" },
      { id: "unlisted-b", provider: "jd-chat", owned_by: "jd" },
      { id: "unlisted-c", provider: "jd-chat", owned_by: "jd" },
      { id: "unlisted-d", provider: "jd-chat", owned_by: "jd" },
      { id: "unlisted-e", provider: "jd-chat", owned_by: "jd" },
      // Placed only by modelPickerOrder -> high tier -> must stay out of the candidate window.
      { id: "deepseek-v4-pro", provider: "tyler", owned_by: "tyler" },
      { id: "kimi-k3", provider: "jd-chat", owned_by: "jd" },
    ] as unknown as CatalogModel[];
    const order = ["tyler/deepseek-v4-pro", "jd-chat/kimi-k3"];
    const entries = buildCatalogEntriesFromObservedState({
      template: template() as never,
      gptSlugs: [],
      goModels: manyRouted,
      featured: [],
      modelPickerOrder: order,
      wsEnabled: false,
      multiAgentMode: "default",
      exactComboSlugs: new Set(),
      accountSelectors: [],
      suppressedBareNativeSlugs: new Set(),
      disabledNativeAccountSlugs: new Set(),
      multiAgentV2Enabled: false,
    });
    const candidateSlugs = effectiveSubagentRoster([], "default", entries).candidates.map(c => c.model);
    expect(candidateSlugs.length).toBe(MAX_SPAWN_AGENT_MODEL_OVERRIDES);
    // The picker-order-only rows are pushed to the high tier and never enter the window.
    expect(candidateSlugs).not.toContain("tyler/deepseek-v4-pro");
    expect(candidateSlugs).not.toContain("jd-chat/kimi-k3");
  });
});
