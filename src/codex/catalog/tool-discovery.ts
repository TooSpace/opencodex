import type { OcxProviderConfig, OcxRoutedToolDiscoveryMode } from "../../types";
import { modelRecordValue } from "../../reasoning-effort";

/**
 * Route-scoped Codex tool-discovery policy.
 *
 * `supports_search_tool` selects Codex's DEFERRED tool-discovery surface. It is not the
 * hosted web-search capability (`web_search_tool_type`), and under `tool_mode =
 * code_mode_only` it does not decide whether an eligible MCP tool is reachable: upstream
 * installs nested tool specs on the code-mode `tools`/`ALL_TOOLS` globals in BOTH
 * exposures (codex-rs `spec_plan.rs` build_code_mode_executors → `code-mode/src/runtime/
 * globals.rs`). What changes is where the schemas live — direct exposure embeds every MCP
 * declaration in `exec.description`, the measured 96,699 → 258,929 char turn-1 regression
 * behind PR #1596 — plus `tool_search` construction and the deferred-guidance text.
 *
 * So `direct` is a compatibility/comprehension lever with a payload cost, NOT a
 * reachability fix. It also cannot repair a tool removed by `direct_only_tool_namespaces`,
 * `excluded_tool_namespaces`, or MCP/App policy filtering, all of which are independent of
 * this flag. Full analysis and citations:
 * devlog/_plan/260813_routed_tool_discovery_profiles/094_landing_verification_pass.md.
 */
export type ResolvedRoutedToolDiscoveryMode = "deferred" | "direct";

export const ROUTED_TOOL_DISCOVERY_MODES: readonly OcxRoutedToolDiscoveryMode[] = [
  "auto",
  "deferred",
  "direct",
] as const;

export function isRoutedToolDiscoveryMode(value: unknown): value is OcxRoutedToolDiscoveryMode {
  return value === "auto" || value === "deferred" || value === "direct";
}

/** Why a row resolved the way it did. Diagnostics only — never serialized into the catalog. */
export type RoutedToolDiscoverySource =
  | "cursor-hard-fence"
  | "model-override"
  | "provider-override"
  | "default";

export interface ResolvedRoutedToolDiscovery {
  readonly mode: ResolvedRoutedToolDiscoveryMode;
  readonly source: RoutedToolDiscoverySource;
  /** The configured value before resolution; `auto` never reaches serialization. */
  readonly configured: OcxRoutedToolDiscoveryMode;
  readonly reason: string;
  readonly warning?: string;
}

export const CURSOR_PROVIDER_ID = "cursor";
const CURSOR_SLUG_PREFIX = `${CURSOR_PROVIDER_ID}/`;

/**
 * Cursor identity as the RESOLVER sees it: provider name or adapter. A gateway can be named
 * anything while speaking Cursor's custom runTurn transport, and it is the transport — not
 * the label — that has no deferred path.
 */
export function isCursorProviderIdentity(providerName: string | undefined, adapter: string | undefined): boolean {
  return providerName === CURSOR_PROVIDER_ID || adapter === CURSOR_PROVIDER_ID;
}

export interface CursorRouteSignals {
  /** Canonical provider id from the CatalogModel, when the caller has one. */
  providerId?: string;
  /** Fence resolved upstream where the provider name AND adapter were both known. */
  cursorRoute?: boolean;
}

/**
 * The single Cursor fence, shared by the template and template-less catalog paths.
 *
 * This is a UNION of every available signal, deliberately, because the two construction
 * paths historically disagreed: `parsing.ts` tested `slug.startsWith("cursor/")` while
 * `sync.ts` tested `model?.provider === "cursor"`, so a `cursor/`-aliased combo whose
 * canonical provider is `combo` was classified differently depending on whether a template
 * happened to exist (unresolved P2 on PR #1596). Any single-signal reconciliation would
 * silently UNFENCE rows that one path used to fence, and an under-fenced Cursor row
 * advertises a deferred surface its transport cannot serve.
 *
 * The union is therefore the compatibility-preserving direction: it keeps every result the
 * template path already produced. It is not free — combo aliases may legally carry one
 * slash and only `combo/` is reserved, so a combo aliased `cursor/<name>` is routed by the
 * combo subsystem yet still gets fenced, losing hosted-search metadata and taking Cursor's
 * parallel-tool advertisement, not merely paying payload. That row's fenced shape is
 * exactly what shipped before this change, so this preserves behavior rather than
 * regressing it. The real fix is to reserve the `cursor/` alias prefix (or move to an
 * authoritative route identity) as a deliberate, documented compatibility break.
 *
 * `cursorRoute` carries the resolver's verdict (provider name or adapter), which is the only
 * signal that catches a Cursor-adapter gateway under a custom provider name.
 */
export function isCursorRoute(slug: unknown, signals: CursorRouteSignals = {}): boolean {
  if (signals.cursorRoute === true) return true;
  if (signals.providerId === CURSOR_PROVIDER_ID) return true;
  return typeof slug === "string" && slug.startsWith(CURSOR_SLUG_PREFIX);
}

/**
 * Resolve one routed provider/model to a catalog-facing mode.
 *
 * Precedence: Cursor hard fence > exact model override > provider override > auto default.
 * `auto` resolves to `deferred` for non-Cursor rows, preserving PR #1596 byte-for-byte.
 *
 * Model keys follow `modelRecordValue()` semantics — exact id, the family before a `:`, or
 * a case-insensitive full-id match. Dated `-YYYYMMDD` variants are NOT matched; name the
 * exact model id that failed.
 */
export function resolveConfiguredRoutedToolDiscoveryMode(
  providerName: string,
  provider: Pick<OcxProviderConfig, "adapter" | "routedToolDiscovery" | "modelRoutedToolDiscovery">,
  modelId: string,
): ResolvedRoutedToolDiscovery {
  const modelConfigured = modelRecordValue(provider.modelRoutedToolDiscovery, modelId);
  const providerConfigured = provider.routedToolDiscovery;
  const configured: OcxRoutedToolDiscoveryMode = modelConfigured ?? providerConfigured ?? "auto";
  const source: RoutedToolDiscoverySource = modelConfigured !== undefined
    ? "model-override"
    : providerConfigured !== undefined
      ? "provider-override"
      : "default";

  // Cursor's runTurn transport bypasses the web-search sidecar and has no proven deferred
  // path, so the fence outranks any configuration rather than silently accepting it.
  if (isCursorProviderIdentity(providerName, provider.adapter)) {
    return {
      mode: "direct",
      source: "cursor-hard-fence",
      configured,
      reason: "Cursor's runTurn transport has no verified deferred discovery path.",
      ...(configured === "deferred"
        ? { warning: "Configured deferred discovery was ignored for Cursor." }
        : {}),
    };
  }

  if (configured === "direct") {
    return {
      mode: "direct",
      source,
      configured,
      reason: "A route-scoped compatibility override selected direct discovery.",
      warning: "Direct discovery embeds full MCP declarations in the first request.",
    };
  }

  return {
    mode: "deferred",
    source,
    configured,
    reason: configured === "deferred"
      ? "The route explicitly selected Codex deferred discovery."
      : "Non-Cursor auto mode preserves the Code Mode default.",
  };
}

/**
 * One public combo row cannot change capabilities after a target is selected, so a single
 * direct-only member forces the whole combo direct. Advertising deferred discovery when a
 * possible target was explicitly marked incompatible would strand that target.
 */
export function deriveComboToolDiscoveryMode(
  memberModes: readonly (ResolvedRoutedToolDiscoveryMode | undefined)[],
): ResolvedRoutedToolDiscoveryMode {
  return memberModes.some(mode => mode === "direct") ? "direct" : "deferred";
}
