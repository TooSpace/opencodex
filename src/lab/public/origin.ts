import { readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { jcsStringify } from "../digest";
import { ensureLabDirs, labPublicOriginDir } from "../paths";
import { readPrivateRegularFile } from "./file-safety";
import {
  cleanupStalePrivateFileStagesInDir,
  isPrivateFileStageName,
  publishPrivateFileExclusive,
} from "./private-file";
import { parseStrictPublicJson } from "./strict-json";
import { PublicEvidenceValidationError } from "./validate";

const MAX_ORIGINS = 512;
const MAX_ORIGIN_BYTES = 1024;
const ORIGIN_RE = /^origin-([0-9a-f]{64})-([0-9a-f]{64})\.json$/;

export interface PublicOriginIdentityV1 {
  publisherKeyId: string;
  bundleId: string;
}

function originPath(identity: PublicOriginIdentityV1, configDir?: string): string {
  if (!/^[0-9a-f]{64}$/.test(identity.publisherKeyId) || !/^[0-9a-f]{64}$/.test(identity.bundleId)) {
    throw new PublicEvidenceValidationError("public_origin_id", "public origin identity is invalid");
  }
  return join(
    labPublicOriginDir(configDir),
    `origin-${identity.publisherKeyId}-${identity.bundleId}.json`,
  );
}

function originBody(identity: PublicOriginIdentityV1): Buffer {
  return Buffer.from(jcsStringify({
    schemaVersion: "public_origin_v1",
    publisherKeyId: identity.publisherKeyId,
    bundleId: identity.bundleId,
  }), "utf8");
}

function readOrigin(path: string, expected?: PublicOriginIdentityV1): PublicOriginIdentityV1 {
  const bytes = readPrivateRegularFile(path, {
    maxBytes: MAX_ORIGIN_BYTES,
    errorCode: "public_origin_unsafe",
    errorMessage: "public origin marker is not a private regular file with 0600 permissions",
    sizeErrorCode: "public_origin_unsafe",
    sizeErrorMessage: "public origin marker exceeds its size bound",
    requireMode600: true,
  });
  const raw = parseStrictPublicJson(bytes, "public origin marker", "public_origin_json");
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new PublicEvidenceValidationError("public_origin_json", "public origin marker must be an object");
  }
  const row = raw as Record<string, unknown>;
  if (Object.keys(row).sort().join(",") !== "bundleId,publisherKeyId,schemaVersion"
    || row.schemaVersion !== "public_origin_v1"
    || typeof row.publisherKeyId !== "string"
    || typeof row.bundleId !== "string"
    || !/^[0-9a-f]{64}$/.test(row.publisherKeyId)
    || !/^[0-9a-f]{64}$/.test(row.bundleId)) {
    throw new PublicEvidenceValidationError("public_origin_json", "public origin marker schema is invalid");
  }
  const identity = { publisherKeyId: row.publisherKeyId, bundleId: row.bundleId };
  if (expected && (identity.publisherKeyId !== expected.publisherKeyId || identity.bundleId !== expected.bundleId)) {
    throw new PublicEvidenceValidationError("public_origin_conflict", "public origin marker identity mismatch");
  }
  return identity;
}

function originNames(dir: string): string[] {
  cleanupStalePrivateFileStagesInDir(dir);
  return readdirSync(dir).filter((name) => !isPrivateFileStageName(name)).sort();
}

export function recordLocalPublicOrigin(identity: PublicOriginIdentityV1, configDir?: string): void {
  ensureLabDirs(configDir);
  const dir = labPublicOriginDir(configDir);
  const names = originNames(dir);
  const path = originPath(identity, configDir);
  try {
    const existing = readOrigin(path, identity);
    void existing;
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (names.length >= MAX_ORIGINS) {
    throw new PublicEvidenceValidationError("public_origin_bound", "public origin marker bound exceeded");
  }
  const bytes = originBody(identity);
  const published = publishPrivateFileExclusive(path, bytes);
  if (!published.created) {
    readOrigin(path, identity);
    return;
  }

  // The pre-check is intentionally followed by a post-publication check. Separate CLI
  // processes can both observe one free slot before either publishes. The loser removes
  // only the marker it created, so the durable directory converges back inside the cap.
  if (originNames(dir).length > MAX_ORIGINS) {
    try { unlinkSync(path); } catch { /* preserve the quota failure */ }
    throw new PublicEvidenceValidationError("public_origin_bound", "public origin marker bound exceeded");
  }
}

export function listLocalPublicOrigins(configDir?: string): PublicOriginIdentityV1[] {
  ensureLabDirs(configDir);
  const dir = labPublicOriginDir(configDir);
  const names = originNames(dir);
  if (names.length > MAX_ORIGINS) {
    throw new PublicEvidenceValidationError("public_origin_bound", "public origin marker bound exceeded");
  }
  const identities: PublicOriginIdentityV1[] = [];
  for (const name of names) {
    const match = ORIGIN_RE.exec(name);
    if (!match) {
      throw new PublicEvidenceValidationError("public_origin_unsafe", "unexpected public origin marker entry");
    }
    const expected = { publisherKeyId: match[1]!, bundleId: match[2]! };
    identities.push(readOrigin(join(dir, name), expected));
  }
  return identities;
}

export function clearLocalPublicOrigins(configDir?: string): void {
  ensureLabDirs(configDir);
  const dir = labPublicOriginDir(configDir);
  cleanupStalePrivateFileStagesInDir(dir);
  for (const name of readdirSync(dir)) {
    if (!ORIGIN_RE.test(name)) continue;
    try { unlinkSync(join(dir, name)); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
