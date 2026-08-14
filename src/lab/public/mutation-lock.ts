import { randomUUID } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureLabDirs, labCommunityDir } from "../paths";
import { PublicEvidenceValidationError } from "./validate";

const PUBLIC_EVIDENCE_MUTATION_LOCK_NAME = ".mutation-lock";
const PUBLIC_EVIDENCE_MUTATION_LOCK_OWNER = "owner.json";
const PUBLIC_EVIDENCE_MUTATION_LOCK_TIMEOUT_MS = 5_000;
const PUBLIC_EVIDENCE_MUTATION_LOCK_STALE_MS = 60_000;
const PUBLIC_EVIDENCE_MUTATION_LOCK_POLL_MS = 10;

type MutationLockOwner = {
  pid: number;
  token: string;
  createdAt: number;
};

function mutationLockPath(configDir?: string): string {
  return join(labCommunityDir(configDir), PUBLIC_EVIDENCE_MUTATION_LOCK_NAME);
}

function mutationLockOwnerPath(lockPath: string): string {
  return join(lockPath, PUBLIC_EVIDENCE_MUTATION_LOCK_OWNER);
}

function pidDefinitelyDead(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ESRCH";
  }
}

function readMutationLockOwner(lockPath: string): MutationLockOwner | null {
  try {
    const raw = JSON.parse(readFileSync(mutationLockOwnerPath(lockPath), "utf8")) as Partial<MutationLockOwner>;
    if (
      Number.isSafeInteger(raw.pid)
      && Number(raw.pid) > 0
      && typeof raw.token === "string"
      && /^[0-9a-f-]{36}$/.test(raw.token)
      && Number.isSafeInteger(raw.createdAt)
      && Number(raw.createdAt) > 0
    ) {
      return { pid: Number(raw.pid), token: raw.token, createdAt: Number(raw.createdAt) };
    }
  } catch {
    // A writer can die after mkdir and before owner publication. The directory
    // age fallback below recovers that incomplete acquisition after the stale bound.
  }
  return null;
}

function assertMutationLockDirectory(lockPath: string) {
  const stat = lstatSync(lockPath);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new PublicEvidenceValidationError(
      "community_cache_lock",
      "community cache mutation lock is not a directory",
    );
  }
  return stat;
}

function mutationLockIsReclaimable(lockPath: string, nowMs: number): boolean {
  const stat = assertMutationLockDirectory(lockPath);
  const owner = readMutationLockOwner(lockPath);
  if (owner) {
    // Age alone must never evict a live owner. A full cache verification or slow
    // filesystem can legitimately exceed the stale-age fallback.
    return pidDefinitelyDead(owner.pid);
  }
  return nowMs - stat.mtimeMs > PUBLIC_EVIDENCE_MUTATION_LOCK_STALE_MS;
}

function publishMutationLockOwner(lockPath: string, owner: MutationLockOwner): void {
  try {
    writeFileSync(
      mutationLockOwnerPath(lockPath),
      JSON.stringify(owner),
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
  } catch (error) {
    try { rmSync(lockPath, { recursive: true, force: true }); } catch { /* preserve owner-write failure */ }
    throw error;
  }
}

function releaseMutationLock(lockPath: string, owner: MutationLockOwner): void {
  const current = readMutationLockOwner(lockPath);
  if (!current || current.pid !== owner.pid || current.token !== owner.token) return;
  try {
    rmSync(lockPath, { recursive: true, force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

/** Serialize public-evidence mutations across CLI/server processes with ownership-safe stale recovery. */
export function withPublicEvidenceMutationLock<T>(
  configDir: string | undefined,
  run: () => T,
): T {
  ensureLabDirs(configDir);
  const lockPath = mutationLockPath(configDir);
  const deadline = Date.now() + PUBLIC_EVIDENCE_MUTATION_LOCK_TIMEOUT_MS;
  const waiter = new Int32Array(new SharedArrayBuffer(4));
  let owner: MutationLockOwner | null = null;

  while (true) {
    try {
      mkdirSync(lockPath, { mode: 0o700 });
      owner = { pid: process.pid, token: randomUUID(), createdAt: Date.now() };
      publishMutationLockOwner(lockPath, owner);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        if (mutationLockIsReclaimable(lockPath, Date.now())) {
          rmSync(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw statError;
      }
      if (Date.now() >= deadline) {
        throw new PublicEvidenceValidationError("community_cache_busy", "community cache is busy");
      }
      Atomics.wait(waiter, 0, 0, PUBLIC_EVIDENCE_MUTATION_LOCK_POLL_MS);
    }
  }

  try {
    return run();
  } finally {
    if (owner) releaseMutationLock(lockPath, owner);
  }
}

/** Test-only seam for stale-owner policy. This module is not barrel-exported. */
export function publicEvidenceMutationLockIsReclaimableForTests(
  configDir: string | undefined,
  nowMs = Date.now(),
): boolean {
  return mutationLockIsReclaimable(mutationLockPath(configDir), nowMs);
}
