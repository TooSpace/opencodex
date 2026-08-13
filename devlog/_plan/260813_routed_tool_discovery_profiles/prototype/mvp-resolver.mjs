/**
 * Executable, dependency-free prototype of the proposed phase-1 resolver.
 * It is intentionally separate from the OpenCodex source tree so the policy can
 * be tested in this artifact bundle without claiming a full repository build.
 */

export const ROUTED_TOOL_DISCOVERY_MODES = Object.freeze([
  "auto",
  "deferred",
  "direct",
]);

export function isRoutedToolDiscoveryMode(value) {
  return ROUTED_TOOL_DISCOVERY_MODES.includes(value);
}

function configuredMode({ providerMode, modelMode }) {
  if (modelMode !== undefined) {
    if (!isRoutedToolDiscoveryMode(modelMode)) {
      throw new TypeError(`invalid model routed-tool discovery mode: ${String(modelMode)}`);
    }
    return { configured: modelMode, source: "model-override" };
  }
  if (providerMode !== undefined) {
    if (!isRoutedToolDiscoveryMode(providerMode)) {
      throw new TypeError(`invalid provider routed-tool discovery mode: ${String(providerMode)}`);
    }
    return { configured: providerMode, source: "provider-override" };
  }
  return { configured: "auto", source: "default" };
}

/**
 * Resolve the catalog-facing mode. `auto` never reaches serialization.
 *
 * Precedence:
 *   Cursor hard fence > exact model override > provider override > auto default.
 */
export function resolveRoutedToolDiscovery({
  providerName,
  adapter,
  providerMode,
  modelMode,
}) {
  const isCursor = providerName === "cursor" || adapter === "cursor";
  const selected = configuredMode({ providerMode, modelMode });

  if (isCursor) {
    return Object.freeze({
      mode: "direct",
      source: "cursor-hard-fence",
      configured: selected.configured,
      reason: "Cursor's runTurn transport has no verified deferred/sidecar path.",
      warning: selected.configured === "deferred"
        ? "Configured deferred mode was ignored for Cursor."
        : undefined,
    });
  }

  if (selected.configured === "direct") {
    return Object.freeze({
      mode: "direct",
      source: selected.source,
      configured: selected.configured,
      reason: "An explicit route-scoped compatibility override selected direct discovery.",
      warning: "Direct discovery can expand the first request in proportion to MCP schema bytes.",
    });
  }

  return Object.freeze({
    mode: "deferred",
    source: selected.source,
    configured: selected.configured,
    reason: selected.configured === "deferred"
      ? "The route explicitly selected Codex deferred discovery."
      : "Non-Cursor auto mode preserves the PR #1596 Code Mode default.",
    warning: undefined,
  });
}

/** Apply only the catalog fields owned by this policy. */
export function applyRoutedToolDiscoveryPolicy(entry, resolved) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new TypeError("entry must be a plain object");
  }
  if (!resolved || (resolved.mode !== "deferred" && resolved.mode !== "direct")) {
    throw new TypeError("resolved mode must be deferred or direct");
  }

  const clone = structuredClone(entry);
  const isCursor = typeof clone.slug === "string" && clone.slug.startsWith("cursor/");
  clone.tool_mode = "code_mode_only";

  // Hosted search remains independent from MCP/plugin discovery.
  if (isCursor) {
    delete clone.web_search_tool_type;
  } else {
    clone.web_search_tool_type = "text_and_image";
  }
  clone.supports_search_tool = !isCursor && resolved.mode === "deferred";
  return clone;
}

/** Direct wins for a combo because one public row cannot vary after target selection. */
export function deriveComboToolDiscoveryMode(memberModes) {
  if (!Array.isArray(memberModes) || memberModes.length === 0) {
    return "deferred";
  }
  for (const mode of memberModes) {
    if (mode !== undefined && mode !== "deferred" && mode !== "direct") {
      throw new TypeError(`invalid resolved member mode: ${String(mode)}`);
    }
  }
  return memberModes.some(mode => mode === "direct") ? "direct" : "deferred";
}
