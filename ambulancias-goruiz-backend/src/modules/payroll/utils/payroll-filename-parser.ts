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
 * Attempt to extract an employeeNumber candidate directly from the raw filename
 * stem using regex, before any normalization.
 *
 * Strategy:
 *  1. EMP-prefix pattern  /EMP\d+/i  → returned uppercased  (e.g. "EMP0001")
 *  2. Bare digit run      /\d{4,}/   → returned as-is       (e.g. "0001")
 *     (minimum 4 digits to avoid matching 3-char month codes or 3-digit sequences)
 *
 * Returns null when neither pattern matches so the caller can fall back to the
 * existing token-sequence approach.
 */
function extractCandidateFromStem(stem: string): string | null {
  const empMatch = stem.match(/EMP\d+/i);
  if (empMatch) return empMatch[0].toUpperCase();

  const digitMatch = stem.match(/\d{4,}/);
  if (digitMatch) return digitMatch[0];

  return null;
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

  // Only fetch active workers with a non-empty employeeNumber in this company.
  // isActive: true ensures deactivated workers are never auto-matched to new
  // payroll uploads (Phase 7b). Historical documents already assigned to
  // deactivated workers are unaffected — this query only runs on new uploads.
  const workers = await User.find({
    companyId: companyOid,
    role: "worker",
    isActive: true,
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

  // Primary path: extract a candidate directly from the raw stem via regex.
  // This handles EMP-prefixed formats (EMP0001, emp0001) and pure-digit numbers
  // (0001) without being sensitive to separator style or casing around the token.
  // When no regex candidate is found the loop falls back to the original
  // token-sequence approach so existing behaviour is fully preserved.
  const stem = originalName.replace(/\.[^.]+$/, "");
  const regexCandidate = extractCandidateFromStem(stem);

  const matches: Array<{ workerId: string; parsedEmployeeNumber: string }> = [];

  for (const worker of workers) {
    const raw = worker.employeeNumber;
    if (!raw || !raw.trim()) continue;

    let matched: boolean;

    if (regexCandidate !== null) {
      // Case-insensitive exact match between the regex-extracted candidate and
      // the stored employeeNumber (both normalised to uppercase + trimmed).
      matched = regexCandidate === raw.trim().toUpperCase();
    } else {
      // Fallback: original token-sequence approach.
      const normalizedEmp = normalize(raw);

      // Guard: fewer than 4 non-space chars → too short to be a reliable discriminator
      if (normalizedEmp.replace(/\s/g, "").length < MIN_EMP_NUM_LENGTH) continue;

      const empTokens = tokenize(normalizedEmp);
      matched = includesSequence(filenameTokens, empTokens);
    }

    if (matched) {
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
