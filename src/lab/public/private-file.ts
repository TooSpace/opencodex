import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  fsyncSync,
  linkSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { dirname, join } from "node:path";

export type PrivateFileCommitFault = "before_publish" | null;
let privateFileCommitFaultForTests: PrivateFileCommitFault = null;

function cleanup(path: string): void {
  try { unlinkSync(path); } catch { /* absent/already removed */ }
}

function fsyncParentBestEffort(path: string): void {
  let fd: number | null = null;
  try {
    fd = openSync(dirname(path), fsConstants.O_RDONLY);
    fsyncSync(fd);
  } catch {
    // Directory fsync is unavailable on some supported platforms/filesystems.
    // File fsync plus exclusive publication still prevents partial final files.
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

function writeAll(fd: number, bytes: Uint8Array): void {
  let offset = 0;
  while (offset < bytes.byteLength) {
    const count = writeSync(fd, bytes, offset, bytes.byteLength - offset);
    if (count <= 0) throw new Error("private file write made no progress");
    offset += count;
  }
}

/**
 * Publish immutable mode-0600 bytes without ever exposing a partially-written final path.
 * The caller owns EEXIST comparison semantics because some objects are idempotent and
 * others are identity conflicts.
 */
export function publishPrivateFileExclusive(
  finalPath: string,
  bytes: Uint8Array,
): { created: boolean } {
  const tempPath = join(dirname(finalPath), `.${randomUUID()}.tmp`);
  let fd: number | null = null;
  try {
    fd = openSync(tempPath, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL, 0o600);
    writeAll(fd, bytes);
    fsyncSync(fd);
    closeSync(fd);
    fd = null;

    if (privateFileCommitFaultForTests === "before_publish") {
      throw new Error("synthetic private-file commit failure before publish");
    }

    try {
      linkSync(tempPath, finalPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return { created: false };
      throw error;
    }
    fsyncParentBestEffort(finalPath);
    return { created: true };
  } finally {
    if (fd !== null) closeSync(fd);
    cleanup(tempPath);
  }
}

export function readPublishedPrivateFile(path: string): Buffer {
  return readFileSync(path);
}

/** Test-only fault seam at the atomic publication point. */
export function setPrivateFileCommitFaultForTests(fault: PrivateFileCommitFault): void {
  privateFileCommitFaultForTests = fault;
}
