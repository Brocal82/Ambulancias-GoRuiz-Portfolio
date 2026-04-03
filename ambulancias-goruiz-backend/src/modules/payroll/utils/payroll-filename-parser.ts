import mongoose from "mongoose";
import User from "../../users/models/user.model";

/**
 * Conservative filename-based worker matching for payroll documents.
 *
 * Matching rules (all must hold for a match to be accepted):
 *  - Scoped to the admin's company only — never cross-company
 *  - Normalized exact token-sequence match: the worker's employeeNumber
 *    must appear as a contiguous sequence of normalized tokens in the filename stem
 *  - Minimum length guard: employeeNumber must be at least 4 non-space
 *    characters after normalization. 3-char strings are excluded because they
 *    overlap with common German month abbreviations (jan, feb, mar, apr, mai,
 *    jun, jul, aug, sep, okt, nov, dez) and 3-digit sequence numbers (001, 025)
 *    that appear in typical payroll filenames and would produce false positives.
 *  - Zero matches  → unmatched
 *  - Multiple matches → unmatched (ambiguous — never guess)
 *  - Exactly one match → matched
 *
 * Wrong assignment is worse than unmatched.
 */

const MIN_EMP_NUM_LENGTH = 4;

export type ParsedMatchResult =
  | {
      status: "matched";
      parsedEmployeeNumber: string;
      workerId: string;
    }
  | {
      status: "unmatched";
      parsedEmployeeNumber: null;
      reason: string;
    };

/**
 * Normalize a string for comparison:
 *  - Trim
 *  - Lowercase
 *  - Collapse runs of separators (space, hyphen, underscore, dot) into a single space
 */
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[\s\-_.]+/g, " ").trim();
}

/**
 * Split a normalized string into individual tokens.
 */
function tokenize(normalized: string): string[] {
  return normalized.split(" ").filter(Boolean);
}

/**
 * Returns true if `needle` (a token array) appears as a contiguous subsequence
 * inside `haystack`. Both arrays must already be tokenized.
 */
function includesSequence(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    if (needle.every((token, j) => haystack[i + j] === token)) return true;
  }
  return false;
}

/**
 * Strip the file extension and tokenize the original filename stem.
 */
function tokenizeFilename(originalName: string): string[] {
  const stem = originalName.replace(/\.[^.]+$/, "");
  return tokenize(normalize(stem));
}

/**
 * Attempt to match a single worker in `companyId` by finding their
 * `employeeNumber` as a contiguous token sequence inside `originalName`.
 *
 * Only the `originalName` (the filename before multer renames it) is used —
 * the multer-generated `filename` is an opaque UUID-style string and is not parsed.
 */
export async function matchWorkerFromFilename(
  originalName: string,
  companyId: string,
): Promise<ParsedMatchResult> {
  const filenameTokens = tokenizeFilename(originalName);

  if (filenameTokens.length === 0) {
    return {
      status: "unmatched",
      parsedEmployeeNumber: null,
      reason: "El nombre del archivo no contiene tokens reconocibles",
    };
  }

  const companyOid = new mongoose.Types.ObjectId(companyId);

  // Only fetch workers with a non-empty employeeNumber in this company
  const workers = await User.find({
    companyId: companyOid,
    role: "worker",
    employeeNumber: { $exists: true, $nin: [null, ""] },
  })
    .select("_id employeeNumber")
    .lean() as Array<{ _id: unknown; employeeNumber?: string }>;

  if (workers.length === 0) {
    return {
      status: "unmatched",
      parsedEmployeeNumber: null,
      reason:
        "Ningún trabajador de esta empresa tiene número de empleado registrado",
    };
  }

  const matches: Array<{ workerId: string; parsedEmployeeNumber: string }> = [];

  for (const worker of workers) {
    const raw = worker.employeeNumber;
    if (!raw || !raw.trim()) continue;

    const normalizedEmp = normalize(raw);

    // Guard: fewer than 4 non-space chars → too short to be a reliable discriminator
    if (normalizedEmp.replace(/\s/g, "").length < MIN_EMP_NUM_LENGTH) continue;

    const empTokens = tokenize(normalizedEmp);

    if (includesSequence(filenameTokens, empTokens)) {
      matches.push({
        workerId: String(worker._id),
        parsedEmployeeNumber: raw.trim(),
      });
    }
  }

  if (matches.length === 0) {
    return {
      status: "unmatched",
      parsedEmployeeNumber: null,
      reason:
        "Ningún número de empleado encontrado en el nombre del archivo",
    };
  }

  if (matches.length > 1) {
    const nums = matches.map((m) => m.parsedEmployeeNumber).join(", ");
    return {
      status: "unmatched",
      parsedEmployeeNumber: null,
      reason: `Coincidencia ambigua — múltiples trabajadores: ${nums}`,
    };
  }

  return {
    status: "matched",
    parsedEmployeeNumber: matches[0].parsedEmployeeNumber,
    workerId: matches[0].workerId,
  };
}
