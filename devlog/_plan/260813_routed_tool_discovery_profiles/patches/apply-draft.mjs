#!/usr/bin/env node
/**
 * ARCHIVAL — KNOWN-DEFECTIVE — DO NOT EXECUTE.
 *
 * This applicator is retained as a SEAM MAP, not as an application path. It
 * writes the Cursor-fence asymmetry described in
 * ../094_landing_verification_pass.md Correction 8: the template path keeps
 * `entry.slug.startsWith("cursor/")` while the template-less path keeps
 * `model?.provider === "cursor"`, so a `cursor/`-aliased combo whose canonical
 * provider is `combo` is classified differently depending on whether a template
 * happened to be available. That is the unresolved #1596 P2 review finding.
 *
 * It also encodes the obsolete positional third argument to
 * `normalizeRoutedCatalogEntry`; the plan now specifies an options object
 * `{ toolDiscoveryMode, providerId }` and one shared `isCursorRoute()` helper
 * used by BOTH construction paths (see ../012_phase1_catalog_patch.md).
 *
 * Crucially, `--check` still prints `draft seams: OK` while all of the above is
 * true: it asserts only that the seams it expects are present, and knows nothing
 * about policy correctness. A green run here is not a verdict.
 *
 * Read it for the `replaceOnce` anchors — they are an accurate map of where the
 * real change lands. Do not run it against a repository you intend to commit
 * from. The implementation PR's diff will not match this draft.
 *
 * Withdrawn usage (kept only so the anchors below read in context):
 *   node apply-draft.mjs --check /path/to/opencodex
 *   node apply-draft.mjs /path/to/opencodex
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const positional = args.filter(arg => arg !== "--check");
const repo = path.resolve(positional[0] ?? process.cwd());
const bundle = path.dirname(fileURLToPath(import.meta.url));
const pendingWrites = [];

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(2);
}

if (!fs.existsSync(path.join(repo, "package.json")) || !fs.existsSync(path.join(repo, "src/codex/catalog/parsing.ts"))) {
  fail(`not an OpenCodex worktree: ${repo}`);
}

function countOccurrences(source, needle) {
  let count = 0;
  let offset = 0;
  while ((offset = source.indexOf(needle, offset)) !== -1) {
    count += 1;
    offset += needle.length;
  }
  return count;
}

function replaceOnce(source, needle, replacement, label) {
  const count = countOccurrences(source, needle);
  if (count !== 1) {
    throw new Error(`${label}: expected one seam, found ${count}`);
  }
  return source.replace(needle, replacement);
}

function edit(rel, transform) {
  const target = path.join(repo, rel);
  const before = fs.readFileSync(target, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`${rel}: transform produced no change`);
  pendingWrites.push({ rel, target, content: after, action: "EDIT" });
  if (checkOnly) console.log(`CHECK ${rel}`);
}

function addFromBundle(rel, sourceRel) {
  const target = path.join(repo, rel);
  const content = fs.readFileSync(path.join(bundle, sourceRel), "utf8");
  if (fs.existsSync(target)) {
    const existing = fs.readFileSync(target, "utf8");
    if (existing !== content) throw new Error(`${rel}: file already exists with different content`);
    console.log(`KEEP  ${rel}`);
    return;
  }
  pendingWrites.push({ rel, target, content, action: "ADD" });
  if (checkOnly) console.log(`CHECK ${rel}`);
}

function writeAtomically(target, content) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = `${target}.ocx-tool-discovery.${process.pid}.tmp`;
  fs.writeFileSync(temp, content, "utf8");
  fs.renameSync(temp, target);
}

try {
  addFromBundle(
    "src/codex/catalog/tool-discovery.ts",
    "proposed/src/codex/catalog/tool-discovery.ts",
  );
  addFromBundle(
    "tests/codex-tool-discovery-mode.test.ts",
    "proposed/tests/codex-tool-discovery-mode.test.ts",
  );

  edit("src/types.ts", source => {
    let out = replaceOnce(
      source,
      "export interface OcxProviderConfig {\n  adapter: string;",
      "export type OcxRoutedToolDiscoveryMode = \"auto\" | \"deferred\" | \"direct\";\n\nexport interface OcxProviderConfig {\n  adapter: string;\n  /** Route-wide Codex discovery policy. Default: auto. */\n  routedToolDiscovery?: OcxRoutedToolDiscoveryMode;\n  /** Per-model override; modelRecordValue matching applies. */\n  modelRoutedToolDiscovery?: Record<string, OcxRoutedToolDiscoveryMode>;",
      "OcxProviderConfig declaration",
    );
    return out;
  });

  edit("src/codex/catalog/parsing.ts", source => {
    let out = replaceOnce(
      source,
      'import { CODEX_NATIVE_ALIAS_CATALOG_KIND } from "./kinds";',
      'import { CODEX_NATIVE_ALIAS_CATALOG_KIND } from "./kinds";\nimport type { ResolvedRoutedToolDiscoveryMode } from "./tool-discovery";',
      "parsing import",
    );
    out = replaceOnce(
      out,
      "  /** Provider opted into parallel tool calls (OcxProviderConfig.parallelToolCalls). */\n  parallelToolCalls?: boolean;",
      "  /** Provider opted into parallel tool calls (OcxProviderConfig.parallelToolCalls). */\n  parallelToolCalls?: boolean;\n  /** Resolved before catalog serialization; auto never reaches this layer. */\n  toolDiscoveryMode?: ResolvedRoutedToolDiscoveryMode;",
      "CatalogModel field",
    );
    out = replaceOnce(
      out,
      "export function normalizeRoutedCatalogEntry(entry: RawEntry, parallelToolCalls = false): RawEntry {",
      "export function normalizeRoutedCatalogEntry(\n  entry: RawEntry,\n  parallelToolCalls = false,\n  toolDiscoveryMode: ResolvedRoutedToolDiscoveryMode = \"deferred\",\n): RawEntry {",
      "normalizeRoutedCatalogEntry signature",
    );
    out = replaceOnce(
      out,
      "  entry.supports_search_tool = !isCursorEntry;",
      "  const effectiveToolDiscoveryMode = isCursorEntry ? \"direct\" : toolDiscoveryMode;\n  entry.supports_search_tool = effectiveToolDiscoveryMode === \"deferred\";",
      "supports_search_tool assignment",
    );
    return out;
  });

  edit("src/codex/catalog/provider-fetch.ts", source => {
    let out = replaceOnce(
      source,
      'import type { CatalogModel } from "./parsing";',
      'import type { CatalogModel } from "./parsing";\nimport { resolveRoutedToolDiscoveryMode } from "./tool-discovery";',
      "provider-fetch tool-discovery import",
    );
    out = replaceOnce(
      out,
      "    ptc: prov.parallelToolCalls ?? null,\n    gMode: prov.googleMode ?? null,",
      "    ptc: prov.parallelToolCalls ?? null,\n    routedToolDiscovery: prov.routedToolDiscovery ?? null,\n    modelRoutedToolDiscovery: prov.modelRoutedToolDiscovery ?? null,\n    gMode: prov.googleMode ?? null,",
      "provider catalog fingerprint",
    );
    out = replaceOnce(
      out,
      "export function applyProviderConfigHints(name: string, prov: OcxProviderConfig, model: CatalogModel, providerCap?: number): CatalogModel {\n  void name;",
      "export function applyProviderConfigHints(name: string, prov: OcxProviderConfig, model: CatalogModel, providerCap?: number): CatalogModel {",
      "applyProviderConfigHints name seam",
    );
    out = replaceOnce(
      out,
      "  const supportsReasoningSummaries = configuredReasoningSummarySupport(prov, model.id);\n  const hinted = {",
      "  const supportsReasoningSummaries = configuredReasoningSummarySupport(prov, model.id);\n  const toolDiscovery = resolveRoutedToolDiscoveryMode(name, prov, model.id);\n  const hinted = {",
      "provider hint resolver",
    );
    out = replaceOnce(
      out,
      "    ...(prov.parallelToolCalls === true || (prov.adapter === \"openai-chat\" && prov.parallelToolCalls !== false)\n      ? { parallelToolCalls: true }\n      : {}),\n  };",
      "    ...(prov.parallelToolCalls === true || (prov.adapter === \"openai-chat\" && prov.parallelToolCalls !== false)\n      ? { parallelToolCalls: true }\n      : {}),\n    toolDiscoveryMode: toolDiscovery.mode,\n  };",
      "provider hint output",
    );
    return out;
  });

  edit("src/codex/catalog/aggregation.ts", source => {
    let out = replaceOnce(
      source,
      'import type { CatalogModel } from "./parsing";',
      'import type { CatalogModel } from "./parsing";\nimport { deriveComboToolDiscoveryMode } from "./tool-discovery";',
      "aggregation tool-discovery import",
    );
    out = replaceOnce(
      out,
      "  const defaultReasoningEffort = effectiveComboDefault(\n    combo.defaultEffort,\n    reasoningEfforts,\n  );",
      "  const defaultReasoningEffort = effectiveComboDefault(\n    combo.defaultEffort,\n    reasoningEfforts,\n  );\n  const toolDiscoveryMode = deriveComboToolDiscoveryMode(\n    members.map(member => member.toolDiscoveryMode),\n  );",
      "combo policy derivation",
    );
    out = replaceOnce(
      out,
      "    ...(members.every(member => member.parallelToolCalls === true)\n      ? { parallelToolCalls: true }\n      : {}),\n    ...(members.some(member => member.supportsReasoningSummaries === false) ? { supportsReasoningSummaries: false } : {}),",
      "    ...(members.every(member => member.parallelToolCalls === true)\n      ? { parallelToolCalls: true }\n      : {}),\n    toolDiscoveryMode,\n    ...(members.some(member => member.supportsReasoningSummaries === false) ? { supportsReasoningSummaries: false } : {}),",
      "combo return field",
    );
    out = replaceOnce(
      out,
      "      parallelToolCalls: member?.parallelToolCalls === true,\n      supportsReasoningSummaries: member?.supportsReasoningSummaries !== false,",
      "      parallelToolCalls: member?.parallelToolCalls === true,\n      toolDiscoveryMode: member?.toolDiscoveryMode ?? \"deferred\",\n      supportsReasoningSummaries: member?.supportsReasoningSummaries !== false,",
      "combo warning signature",
    );
    return out;
  });

  edit("src/codex/catalog/sync.ts", source => {
    let out = replaceOnce(
      source,
      "      normalizeRoutedCatalogEntry(e, model?.parallelToolCalls === true);",
      "      normalizeRoutedCatalogEntry(\n        e,\n        model?.parallelToolCalls === true,\n        model?.toolDiscoveryMode ?? \"deferred\",\n      );",
      "template catalog normalization call",
    );
    out = replaceOnce(
      out,
      "  const isCursorFallback = isRouted && model?.provider === \"cursor\";\n  const entry: RawEntry = {",
      "  const isCursorFallback = isRouted && model?.provider === \"cursor\";\n  const fallbackToolDiscoveryMode = isCursorFallback\n    ? \"direct\"\n    : model?.toolDiscoveryMode ?? \"deferred\";\n  const entry: RawEntry = {",
      "fallback resolver",
    );
    out = replaceOnce(
      out,
      "        : { web_search_tool_type: \"text_and_image\", supports_search_tool: true }",
      "        : {\n          web_search_tool_type: \"text_and_image\",\n          supports_search_tool: fallbackToolDiscoveryMode === \"deferred\",\n        }",
      "fallback search metadata",
    );
    return out;
  });

  edit("src/config.ts", source => {
    let out = replaceOnce(
      source,
      ").strict();\n\n/**\n * Zod schema for one provider entry:",
      ").strict();\n\nconst routedToolDiscoveryModeSchema = z.enum([\"auto\", \"deferred\", \"direct\"]);\n\n/**\n * Zod schema for one provider entry:",
      "provider schema preamble",
    );
    out = replaceOnce(
      out,
      "const providerConfigSchema = z.object({\n  adapter: z.string().min(1),\n  baseUrl: z.string().min(1),",
      "const providerConfigSchema = z.object({\n  adapter: z.string().min(1),\n  baseUrl: z.string().min(1),\n  routedToolDiscovery: routedToolDiscoveryModeSchema.optional().catch(undefined),\n  modelRoutedToolDiscovery: z.record(z.string(), routedToolDiscoveryModeSchema)\n    .optional()\n    .catch(undefined),",
      "provider discovery schema fields",
    );
    const boundary = `\nfunction routedToolDiscoveryBoundaryError(value: unknown): string | null {\n  const root = rawConfigRecord(value);\n  if (!root) return null;\n  const providers = root.providers;\n  if (!providers || typeof providers !== \"object\" || Array.isArray(providers)) return null;\n  const allowed = new Set([\"auto\", \"deferred\", \"direct\"]);\n  for (const [providerName, rawProvider] of Object.entries(providers as Record<string, unknown>)) {\n    if (!rawProvider || typeof rawProvider !== \"object\" || Array.isArray(rawProvider)) continue;\n    const provider = rawProvider as Record<string, unknown>;\n    const mode = provider.routedToolDiscovery;\n    if (mode !== undefined && (typeof mode !== \"string\" || !allowed.has(mode))) {\n      return \`schema_invalid: providers.\${redactSecretString(providerName)}.routedToolDiscovery: must be auto, deferred, or direct\`;\n    }\n    const modelModes = provider.modelRoutedToolDiscovery;\n    if (modelModes === undefined) continue;\n    if (!modelModes || typeof modelModes !== \"object\" || Array.isArray(modelModes)) {\n      return \`schema_invalid: providers.\${redactSecretString(providerName)}.modelRoutedToolDiscovery: must be a plain object\`;\n    }\n    for (const [modelId, modelMode] of Object.entries(modelModes as Record<string, unknown>)) {\n      if (!modelId.trim()) return \`schema_invalid: providers.\${redactSecretString(providerName)}.modelRoutedToolDiscovery: model ids must be nonblank\`;\n      if (typeof modelMode !== \"string\" || !allowed.has(modelMode)) {\n        return \`schema_invalid: providers.\${redactSecretString(providerName)}.modelRoutedToolDiscovery.\${redactSecretString(modelId)}: must be auto, deferred, or direct\`;\n      }\n    }\n  }\n  return null;\n}\n`;
    out = replaceOnce(
      out,
      "/** Validate an in-memory config candidate without touching disk. Used by headless CLI import/set. */",
      `${boundary}\n/** Validate an in-memory config candidate without touching disk. Used by headless CLI import/set. */`,
      "write-boundary insertion",
    );
    out = replaceOnce(
      out,
      "    ?? loopbackListenerPortError(value);",
      "    ?? loopbackListenerPortError(value)\n    ?? routedToolDiscoveryBoundaryError(value);",
      "write-boundary chain",
    );
    return out;
  });

  edit("src/codex/catalog.ts", source => replaceOnce(
    source,
    'export type { CatalogModel, MultiAgentMode } from "./catalog/parsing";',
    'export type { CatalogModel, MultiAgentMode } from "./catalog/parsing";\nexport { deriveComboToolDiscoveryMode, resolveRoutedToolDiscoveryMode } from "./catalog/tool-discovery";\nexport type { ResolvedRoutedToolDiscovery, ResolvedRoutedToolDiscoveryMode } from "./catalog/tool-discovery";',
    "catalog facade export",
  ));

  if (checkOnly) {
    console.log("draft seams: OK");
  } else {
    // All seam assertions above succeeded before the first write.
    for (const item of pendingWrites) {
      writeAtomically(item.target, item.content);
      console.log(`${item.action.padEnd(5)} ${item.rel}`);
    }
    console.log("draft applied; review git diff before testing");
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
