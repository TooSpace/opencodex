import test from "node:test";
import assert from "node:assert/strict";

import {
  applyRoutedToolDiscoveryPolicy,
  deriveComboToolDiscoveryMode,
  resolveRoutedToolDiscovery,
} from "./mvp-resolver.mjs";
import { resolveToolDiscoveryProfile } from "./profile-resolver.mjs";

const base = {
  providerName: "opencode-go",
  adapter: "openai-chat",
};

test("non-Cursor default preserves deferred discovery", () => {
  const result = resolveRoutedToolDiscovery(base);
  assert.equal(result.mode, "deferred");
  assert.equal(result.source, "default");
  assert.equal(result.configured, "auto");
});

test("provider auto resolves to deferred", () => {
  assert.equal(resolveRoutedToolDiscovery({ ...base, providerMode: "auto" }).mode, "deferred");
});

test("provider deferred resolves to deferred", () => {
  assert.equal(resolveRoutedToolDiscovery({ ...base, providerMode: "deferred" }).mode, "deferred");
});

test("provider direct resolves to direct and emits payload warning", () => {
  const result = resolveRoutedToolDiscovery({ ...base, providerMode: "direct" });
  assert.equal(result.mode, "direct");
  assert.match(result.warning, /first request/i);
});

test("model direct wins over provider deferred", () => {
  const result = resolveRoutedToolDiscovery({
    ...base,
    providerMode: "deferred",
    modelMode: "direct",
  });
  assert.equal(result.mode, "direct");
  assert.equal(result.source, "model-override");
});

test("model deferred wins over provider direct", () => {
  const result = resolveRoutedToolDiscovery({
    ...base,
    providerMode: "direct",
    modelMode: "deferred",
  });
  assert.equal(result.mode, "deferred");
  assert.equal(result.source, "model-override");
});

test("Cursor provider name is hard-fenced to direct", () => {
  const result = resolveRoutedToolDiscovery({
    providerName: "cursor",
    adapter: "openai-responses",
  });
  assert.equal(result.mode, "direct");
  assert.equal(result.source, "cursor-hard-fence");
});

test("custom Cursor adapter is hard-fenced even under another provider name", () => {
  const result = resolveRoutedToolDiscovery({
    providerName: "my-cursor",
    adapter: "cursor",
    modelMode: "deferred",
  });
  assert.equal(result.mode, "direct");
  assert.match(result.warning, /ignored/i);
});

test("non-Cursor direct mode keeps hosted search independent", () => {
  const resolved = resolveRoutedToolDiscovery({ ...base, providerMode: "direct" });
  const row = applyRoutedToolDiscoveryPolicy({ slug: "opencode-go/glm-5.2" }, resolved);
  assert.equal(row.tool_mode, "code_mode_only");
  assert.equal(row.supports_search_tool, false);
  assert.equal(row.web_search_tool_type, "text_and_image");
});

test("non-Cursor deferred mode pins code mode and search together", () => {
  const resolved = resolveRoutedToolDiscovery(base);
  const row = applyRoutedToolDiscoveryPolicy({ slug: "opencode-go/glm-5.2" }, resolved);
  assert.equal(row.tool_mode, "code_mode_only");
  assert.equal(row.supports_search_tool, true);
});

test("Cursor catalog row never advertises hosted or deferred search", () => {
  const resolved = resolveRoutedToolDiscovery({
    providerName: "cursor",
    adapter: "cursor",
    modelMode: "deferred",
  });
  const row = applyRoutedToolDiscoveryPolicy({
    slug: "cursor/auto",
    web_search_tool_type: "text_and_image",
  }, resolved);
  assert.equal(row.supports_search_tool, false);
  assert.ok(!Object.hasOwn(row, "web_search_tool_type"));
});

test("invalid override fails loudly in the prototype", () => {
  assert.throws(
    () => resolveRoutedToolDiscovery({ ...base, providerMode: "eager" }),
    /invalid provider/i,
  );
});

test("combo direct mode wins over deferred members", () => {
  assert.equal(deriveComboToolDiscoveryMode(["deferred", "direct"]), "direct");
  assert.equal(deriveComboToolDiscoveryMode(["deferred", "deferred"]), "deferred");
  assert.equal(deriveComboToolDiscoveryMode([undefined, "deferred"]), "deferred");
});

test("future resolver prefers local Code Mode", () => {
  assert.equal(resolveToolDiscoveryProfile({
    hasCodeModeRuntime: true,
    hasAllToolsIndex: true,
    hasMetaToolSidecar: true,
  }).profile, "codex-local-code-mode");
});

test("future resolver chooses verified native tool search only with complete round trip", () => {
  assert.equal(resolveToolDiscoveryProfile({
    supportsNativeToolSearch: true,
    preservesResponsesLiteAdditionalTools: true,
    preservesCustomTools: true,
    preservesNamespaceTools: true,
    preservesToolSearchHistory: true,
  }).profile, "native-tool-search");
});

test("future resolver falls back to proxy meta-tools", () => {
  assert.equal(resolveToolDiscoveryProfile({
    supportsNativeToolSearch: true,
    preservesResponsesLiteAdditionalTools: false,
    hasMetaToolSidecar: true,
  }).profile, "proxy-meta-tools");
});

test("future resolver finally falls back to bounded direct mode", () => {
  assert.equal(resolveToolDiscoveryProfile({}).profile, "direct-bounded");
});
