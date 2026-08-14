import { describe, expect, test } from "bun:test";
import { buildCatalogEntriesFromObservedState } from "../src/codex/catalog/sync";
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

  test("listed rows sort in declared order; unlisted rows sort after them", () => {
    const p = build({
      modelPickerOrder: [
        "tyler/deepseek-v4-pro",
        "jd-chat/kimi-k3",
        "jd-chat/glm-5.2",
      ],
    });
    // Declared order is honored.
    expect(p["tyler/deepseek-v4-pro"]).toBeLessThan(p["jd-chat/kimi-k3"]);
    expect(p["jd-chat/kimi-k3"]).toBeLessThan(p["jd-chat/glm-5.2"]);
    // The unlisted row sorts after every listed one.
    expect(p["jd-chat/glm-5.2"]).toBeLessThan(p["jd-claude/sonnet-5"]);
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
});
