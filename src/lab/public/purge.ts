import { createPrivateKey, createPublicKey } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import {
  ensureLabDirs,
  labCommunityDir,
  labExportDir,
  labPublicPublisherKeyPath,
} from "../paths";
import { publicEvidenceId } from "./ids";
import { clearLocalPublicOrigins, listLocalPublicOrigins } from "./origin";
import { readPublicEvidenceBundle } from "./storage";
import { parseStrictPublicJson } from "./strict-json";
import { PublicEvidenceValidationError } from "./validate";

const O_NOFOLLOW = (fsConstants as { O_NOFOLLOW?: number }).O_NOFOLLOW ?? 0;
const MAX_PRIVATE_KEY_BYTES = 8 * 1024;
const MAX_COMMUNITY_OBJECT_BYTES = 2 * 1024 * 1024;
const EXPORT_FILE_RE = /^([0-9a-f]{64})\.json$/;
const COMMUNITY_BUNDLE_RE = /^bundle-([0-9a-f]{64})-([0-9a-f]{64})\.json$/;
const COMMUNITY_REVOCATION_RE = /^revocation-([0-9a-f]{64})\.json$/;

/**
 * Publisher provenance is useful only for classifying local community copies. A corrupt
 * key must never block deletion of sensitive exports, so classification fails closed to
 * "unknown publisher" while the purge continues.
 */
function readExistingPublisherKeyId(configDir?: string): string | null {
  const path = labPublicPublisherKeyPath(configDir);
  let fd: number | null = null;
  try {
    fd = openSync(path, fsConstants.O_RDONLY | O_NOFOLLOW);
    const stats = fstatSync(fd);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1 || stats.size > MAX_PRIVATE_KEY_BYTES) {
      return null;
    }
    if (process.platform !== "win32" && (stats.mode & 0o777) !== 0o600) return null;
    const pem = readFileSync(fd, { encoding: "utf8" });
    if (Buffer.byteLength(pem) > MAX_PRIVATE_KEY_BYTES || !pem.includes("BEGIN PRIVATE KEY")) return null;
    const privateKey = createPrivateKey(pem);
    if (privateKey.asymmetricKeyType !== "ed25519") return null;
    const publicKey = createPublicKey(pem);
    const publicKeyDer = publicKey.export({ type: "spki", format: "der" }).toString("base64");
    return publicEvidenceId("publisher_key", { algorithm: "ed25519", publicKey: publicKeyDer });
  } catch {
    return null;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

function publicIdentity(publisherKeyId: string, bundleId: string): string {
  return `${publisherKeyId}:${bundleId}`;
}

/** Best-effort legacy classification only. Malformed exports are still deleted below. */
function localExportIdentities(configDir?: string): Set<string> {
  const identities = new Set<string>();
  for (const entry of readdirSync(labExportDir(configDir), { withFileTypes: true })) {
    const match = EXPORT_FILE_RE.exec(entry.name);
    if (!match) continue;
    try {
      const bundle = readPublicEvidenceBundle(match[1]!, configDir);
      identities.add(publicIdentity(bundle.publisher.keyId, bundle.bundleId));
    } catch {
      // Durable origin markers are the primary provenance source. Never retain a
      // malformed export merely because legacy recovery can no longer parse it.
    }
  }
  return identities;
}

function purgeAllExports(configDir?: string): number {
  let deleted = 0;
  const exportDir = labExportDir(configDir);
  for (const entry of readdirSync(exportDir, { withFileTypes: true })) {
    rmSync(join(exportDir, entry.name), { recursive: entry.isDirectory(), force: true });
    deleted += 1;
  }
  return deleted;
}

function unlinkLocalCommunityFile(path: string, entryName: string): boolean {
  let fd: number | null = null;
  try {
    fd = openSync(path, fsConstants.O_RDONLY | O_NOFOLLOW);
    const stats = fstatSync(fd);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1) {
      throw new PublicEvidenceValidationError(
        "community_unsafe_target",
        `refusing to purge unsafe locally-originated community path: ${entryName}`,
      );
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  } finally {
    if (fd !== null) closeSync(fd);
  }
  try {
    unlinkSync(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function communityObjectPublisherKeyId(path: string): string | null {
  let fd: number | null = null;
  try {
    fd = openSync(path, fsConstants.O_RDONLY | O_NOFOLLOW);
    const stats = fstatSync(fd);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1 || stats.size > MAX_COMMUNITY_OBJECT_BYTES) {
      return null;
    }
    const raw = parseStrictPublicJson(readFileSync(fd), "community object during purge");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const publisher = (raw as { publisher?: unknown }).publisher;
    if (!publisher || typeof publisher !== "object" || Array.isArray(publisher)) return null;
    const keyId = (publisher as { keyId?: unknown }).keyId;
    return typeof keyId === "string" && /^[0-9a-f]{64}$/.test(keyId) ? keyId : null;
  } catch {
    return null;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

export function purgeLocalPublicEvidenceCopies(configDir?: string): {
  deletedExports: number;
  deletedCommunityBundles: number;
  deletedCommunityRevocations: number;
} {
  ensureLabDirs(configDir);

  const exportedIdentities = localExportIdentities(configDir);
  const localPublisherKeyIds = new Set<string>();
  for (const origin of listLocalPublicOrigins(configDir)) {
    exportedIdentities.add(publicIdentity(origin.publisherKeyId, origin.bundleId));
    localPublisherKeyIds.add(origin.publisherKeyId);
  }
  const currentPublisherKeyId = readExistingPublisherKeyId(configDir);
  if (currentPublisherKeyId) localPublisherKeyIds.add(currentPublisherKeyId);
  const communityDir = labCommunityDir(configDir);

  // Sensitive local exports are the mandatory deletion target. Provenance is captured
  // before this point, so cleanup remains possible even after the export bytes disappear.
  const deletedExports = purgeAllExports(configDir);

  let deletedCommunityBundles = 0;
  let deletedCommunityRevocations = 0;
  for (const entry of readdirSync(communityDir, { withFileTypes: true })) {
    const bundleMatch = COMMUNITY_BUNDLE_RE.exec(entry.name);
    if (bundleMatch) {
      const publisherKeyId = bundleMatch[1]!;
      const bundleId = bundleMatch[2]!;
      const locallyOriginated = exportedIdentities.has(publicIdentity(publisherKeyId, bundleId))
        || localPublisherKeyIds.has(publisherKeyId);
      if (locallyOriginated && unlinkLocalCommunityFile(join(communityDir, entry.name), entry.name)) {
        deletedCommunityBundles += 1;
      }
      continue;
    }

    if (COMMUNITY_REVOCATION_RE.test(entry.name)) {
      const path = join(communityDir, entry.name);
      const publisherKeyId = communityObjectPublisherKeyId(path);
      if (publisherKeyId && localPublisherKeyIds.has(publisherKeyId)
        && unlinkLocalCommunityFile(path, entry.name)) {
        deletedCommunityRevocations += 1;
      }
    }
  }

  // Markers are purge-owned provenance only. Remove them last so any failure above can
  // be retried without depending on the export or publisher key still being readable.
  clearLocalPublicOrigins(configDir);
  return { deletedExports, deletedCommunityBundles, deletedCommunityRevocations };
}
