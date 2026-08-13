import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
} from "node:fs";
import { PublicEvidenceValidationError } from "./validate";

const O_NOFOLLOW = (fsConstants as { O_NOFOLLOW?: number }).O_NOFOLLOW ?? 0;

export interface PrivateRegularFileReadOptions {
  maxBytes: number;
  errorCode: string;
  errorMessage: string;
  requireMode600?: boolean;
}

/**
 * Read bytes only after proving that the pathname and the consumed descriptor refer to
 * the same private regular file. The lstat/dev+ino comparison keeps the protection on
 * platforms where O_NOFOLLOW is unavailable instead of silently following a symlink.
 */
export function readPrivateRegularFile(
  path: string,
  options: PrivateRegularFileReadOptions,
): Buffer {
  const pathStats = lstatSync(path);
  if (
    pathStats.isSymbolicLink()
    || !pathStats.isFile()
    || pathStats.nlink !== 1
    || pathStats.size > options.maxBytes
  ) {
    throw new PublicEvidenceValidationError(options.errorCode, options.errorMessage);
  }

  const fd = openSync(path, fsConstants.O_RDONLY | O_NOFOLLOW);
  try {
    const stats = fstatSync(fd);
    if (
      !stats.isFile()
      || stats.nlink !== 1
      || stats.size > options.maxBytes
      || stats.dev !== pathStats.dev
      || stats.ino !== pathStats.ino
    ) {
      throw new PublicEvidenceValidationError(options.errorCode, options.errorMessage);
    }
    if (options.requireMode600 && process.platform !== "win32" && (stats.mode & 0o777) !== 0o600) {
      throw new PublicEvidenceValidationError(options.errorCode, options.errorMessage);
    }
    const bytes = readFileSync(fd);
    if (bytes.byteLength > options.maxBytes) {
      throw new PublicEvidenceValidationError(options.errorCode, options.errorMessage);
    }
    return bytes;
  } finally {
    closeSync(fd);
  }
}
