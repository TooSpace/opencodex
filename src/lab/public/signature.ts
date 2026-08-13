import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as signBytes,
  verify as verifyBytes,
} from "node:crypto";
import { ensureLabDirs, labPublicPublisherKeyPath } from "../paths";
import {
  buildPublicEvidenceBundle,
  expectedPublicBundleIdentity,
  hasCanonicalPublicEvidenceOrder,
  normalizePublicEvidenceContent,
  type BuildPublicEvidenceBundleInput,
} from "./bundle";
import { validatePublicEvidenceAuthorities } from "./community-authority";
import { readPrivateRegularFile } from "./file-safety";
import { publicEvidenceId } from "./ids";
import { cleanupStalePrivateFileStages, publishPrivateFileExclusive } from "./private-file";
import { validatePublicEvidencePrivacy, validatePublicEvidenceRecordPrivacy } from "./privacy";
import type {
  PublicEvidenceBundleV1,
  PublicPublisherV1,
} from "./types";
import { PublicEvidenceValidationError } from "./validate";

const MAX_PRIVATE_KEY_BYTES = 8 * 1024;

export interface PublicPublisherHandle {
  publisher: PublicPublisherV1;
  privateKeyPath: string;
}

function publicKeyBase64(privateKeyPem: string): string {
  const publicKey = createPublicKey(privateKeyPem);
  return publicKey.export({ type: "spki", format: "der" }).toString("base64");
}

function publisherForPrivateKey(privateKeyPem: string): PublicPublisherV1 {
  const publicKey = publicKeyBase64(privateKeyPem);
  return {
    algorithm: "ed25519",
    keyId: publicEvidenceId("publisher_key", { algorithm: "ed25519", publicKey }),
    publicKey,
  };
}

function readRestrictedPrivateKey(path: string): string {
  cleanupStalePrivateFileStages(path);
  const pem = readPrivateRegularFile(path, {
    maxBytes: MAX_PRIVATE_KEY_BYTES,
    errorCode: "public_publisher_key_unsafe",
    errorMessage: "public publisher key path is not a bounded private regular file with 0600 permissions",
    requireMode600: true,
  }).toString("utf8");
  const key = createPrivateKey(pem);
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error("public publisher key must be Ed25519");
  }
  return pem;
}

function createPrivateKeyFile(path: string): string {
  const { privateKey } = generateKeyPairSync("ed25519", {
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  publishPrivateFileExclusive(path, Buffer.from(privateKey, "utf8"));
  return readRestrictedPrivateKey(path);
}

export function loadExistingPublicPublisher(configDir?: string): PublicPublisherHandle | null {
  const privateKeyPath = labPublicPublisherKeyPath(configDir);
  try {
    const privateKeyPem = readRestrictedPrivateKey(privateKeyPath);
    return { publisher: publisherForPrivateKey(privateKeyPem), privateKeyPath };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export function getOrCreatePublicPublisher(configDir?: string): PublicPublisherHandle {
  ensureLabDirs(configDir);
  const existing = loadExistingPublicPublisher(configDir);
  if (existing) return existing;
  const privateKeyPath = labPublicPublisherKeyPath(configDir);
  const privateKeyPem = createPrivateKeyFile(privateKeyPath);
  return { publisher: publisherForPrivateKey(privateKeyPem), privateKeyPath };
}

/** Centralized descriptor-bound signing primitive for the installation publisher key. */
export function signPublicPublisherDigest(handle: PublicPublisherHandle, digestHex: string): string {
  if (!/^[0-9a-f]{64}$/.test(digestHex)) {
    throw new PublicEvidenceValidationError("invalid_digest", "publisher signing digest must be lowercase sha256 hex");
  }
  const privateKeyPem = readRestrictedPrivateKey(handle.privateKeyPath);
  return signBytes(null, Buffer.from(digestHex, "hex"), createPrivateKey(privateKeyPem)).toString("base64");
}

export interface SignPublicEvidenceBundleInput extends Omit<BuildPublicEvidenceBundleInput, "publisher"> {
  configDir?: string;
}

function assertLocalArtifactExportAuthority(input: SignPublicEvidenceBundleInput): void {
  if (input.artifacts.length !== 0) {
    throw new PublicEvidenceValidationError(
      "public_artifact_authority_required",
      "artifact bytes require reviewed public_export policy authority before local signing",
    );
  }
}

export function signPublicEvidenceBundle(input: SignPublicEvidenceBundleInput): PublicEvidenceBundleV1 {
  // Validate every caller-controlled invariant before publisher identity state is touched.
  assertLocalArtifactExportAuthority(input);
  const normalized = normalizePublicEvidenceContent({
    records: input.records,
    artifacts: input.artifacts,
    createdDayUtc: input.createdDayUtc,
  });
  validatePublicEvidenceAuthorities(normalized.records);
  for (const record of normalized.records) validatePublicEvidenceRecordPrivacy(record);

  const handle = getOrCreatePublicPublisher(input.configDir);
  const unsigned = buildPublicEvidenceBundle({ ...normalized, publisher: handle.publisher });
  validatePublicEvidencePrivacy(unsigned);
  return {
    ...unsigned,
    signature: {
      algorithm: "ed25519",
      signedDigest: unsigned.bundleDigest,
      signature: signPublicPublisherDigest(handle, unsigned.bundleDigest),
    },
  };
}

export type PublicBundleVerificationResult =
  | { status: "cryptographically_valid" }
  | { status: "digest_invalid" }
  | { status: "signature_invalid" }
  | { status: "schema_rejected" };

export function verifyPublicEvidenceBundle(bundle: PublicEvidenceBundleV1): PublicBundleVerificationResult {
  try {
    const raw = bundle as unknown as Record<string, unknown>;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { status: "schema_rejected" };
    const allowed = new Set([
      "schemaVersion",
      "exportPolicyVersion",
      "bundleId",
      "createdDayUtc",
      "publisher",
      "records",
      "artifacts",
      "bundleDigest",
      "signature",
    ]);
    if (Object.keys(raw).some((key) => !allowed.has(key))) return { status: "schema_rejected" };
    if (bundle.schemaVersion !== "public_evidence_bundle_v1" || bundle.exportPolicyVersion !== "public_export_policy_v1") {
      return { status: "schema_rejected" };
    }
    if (!bundle.signature || bundle.signature.algorithm !== "ed25519") return { status: "schema_rejected" };
    if (Object.keys(bundle.signature).some((key) => !["algorithm", "signedDigest", "signature"].includes(key))) {
      return { status: "schema_rejected" };
    }
    if (!hasCanonicalPublicEvidenceOrder(bundle)) return { status: "schema_rejected" };
    const expected = expectedPublicBundleIdentity(bundle);
    if (bundle.bundleId !== expected.bundleId || bundle.bundleDigest !== expected.bundleDigest) {
      return { status: "digest_invalid" };
    }
    if (bundle.signature.signedDigest !== bundle.bundleDigest) return { status: "signature_invalid" };
    const key = createPublicKey({
      key: Buffer.from(bundle.publisher.publicKey, "base64"),
      type: "spki",
      format: "der",
    });
    if (key.asymmetricKeyType !== "ed25519") return { status: "signature_invalid" };
    const signature = Buffer.from(bundle.signature.signature, "base64");
    if (signature.toString("base64") !== bundle.signature.signature) return { status: "signature_invalid" };
    const valid = verifyBytes(null, Buffer.from(bundle.bundleDigest, "hex"), key, signature);
    return valid ? { status: "cryptographically_valid" } : { status: "signature_invalid" };
  } catch {
    return { status: "schema_rejected" };
  }
}
