import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  fsyncSync,
  linkSync,
  openSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

export type PrivateFileCommitFault = "before_publish" | null;
let privateFileCommitFaultForTests: PrivateFileCommitFault = null;
const PRIVATE_STAGE_RE = /^\..+\.(\d+)\.[0-9a-f-]{36}\.tmp$/;

function cleanup(path: string): void {
  try { unlinkSync(path); } catch { /* absent/already removed */ }
}

function pidDefinitelyDead(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ESRCH";
  }
}

function staleTempPrefix(finalPath: string): string {
  return `.${basename(finalPath)}.`;
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

export function isPrivateFileStageName(name: string): boolean {
  return PRIVATE_STAGE_RE.test(name);
}

/** Reclaim all private-file stages in a directory whose writer is definitely dead. */
export function cleanupStalePrivateFileStagesInDir(dir: string): void {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  let changed = false;
  for (const name of names) {
    const match = PRIVATE_STAGE_RE.exec(name);
    if (!match) continue;
    const pid = Number(match[1]);
    if (!Number.isSafeInteger(pid) || pid <= 0 || pid === process.pid || !pidDefinitelyDead(pid)) continue;
    try {
      unlinkSync(join(dir, name));
      changed = true;
    } catch {
      // Another cleanup or writer may have removed it after enumeration.
    }
  }
  if (changed) fsyncParentBestEffort(join(dir, "."));
}

/** Reclaim target-scoped staging links from writers that are definitely no longer alive. */
export function cleanupStalePrivateFileStages(finalPath: string): void {
  const dir = dirname(finalPath);
  cleanupStalePrivateFileStagesInDir(dir);
  const prefix = staleTempPrefix(finalPath);
  for (const name of readdirSync(dir)) {
    if (!name.startsWith(prefix) || !name.endsWith(".tmp")) continue;
    const match = PRIVATE_STAGE_RE.exec(name);
    if (!match) continue;
    const pid = Number(match[1]);
    if (!Number.isSafeInteger(pid) || pid <= 0 || pid === process.pid || !pidDefinitelyDead(pid)) continue;
    cleanup(join(dir, name));
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
 * others are identity conflicts. Staging files are target-scoped and stale stages from
 * definitely-dead writers are reclaimed on the next read or publication attempt.
 */
export function publishPrivateFileExclusive(
  finalPath: string,
  bytes: Uint8Array,
): { created: boolean } {
  cleanupStalePrivateFileStages(finalPath);
  const tempPath = join(
    dirname(finalPath),
    `${staleTempPrefix(finalPath)}${process.pid}.${randomUUID()}.tmp`,
  );
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
    fsyncParentBestEffort(finalPath);
  }
}

export function readPublishedPrivateFile(path: string): Buffer {
  cleanupStalePrivateFileStages(path);
  return readFileSync(path);
}

/** Test-only fault seam at the atomic publication point. */
export function setPrivateFileCommitFaultForTests(fault: PrivateFileCommitFault): void {
  privateFileCommitFaultForTests = fault;
}
