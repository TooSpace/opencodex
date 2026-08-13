/** Future four-profile resolver used by phases 3-6 of the roadmap. */

export const TOOL_DISCOVERY_PROFILES = Object.freeze([
  "codex-local-code-mode",
  "native-tool-search",
  "proxy-meta-tools",
  "direct-bounded",
]);

export function resolveToolDiscoveryProfile(capabilities) {
  const c = capabilities ?? {};

  if (c.isCursorSurface === true) {
    return {
      profile: "direct-bounded",
      reason: "Cursor is hard-fenced until its transport proves a deferred path.",
    };
  }

  if (c.hasCodeModeRuntime === true && c.hasAllToolsIndex === true) {
    return {
      profile: "codex-local-code-mode",
      reason: "The client owns the tools registry and exposes tools/ALL_TOOLS locally.",
    };
  }

  if (
    c.supportsNativeToolSearch === true
    && c.preservesResponsesLiteAdditionalTools === true
    && c.preservesCustomTools === true
    && c.preservesNamespaceTools === true
    && c.preservesToolSearchHistory === true
  ) {
    return {
      profile: "native-tool-search",
      reason: "The active protocol path passed the complete native discovery round trip.",
    };
  }

  if (c.hasMetaToolSidecar === true) {
    return {
      profile: "proxy-meta-tools",
      reason: "Native discovery is unverified, but a bounded search/describe/call sidecar exists.",
    };
  }

  return {
    profile: "direct-bounded",
    reason: "No safe deferred or meta-tool route is available.",
  };
}
