import type { PayrollDocument } from "./types";

/**
 * Shared text-match predicate for payroll document lookups.
 * Expects a normalized query string (trimmed + lowercased) from the caller.
 */
export function matchesPayrollDocumentText(
  doc: PayrollDocument,
  normalizedQuery: string,
): boolean {
  const inFilename = doc.originalName.toLowerCase().includes(normalizedQuery);
  const inWorkerName = doc.workerId
    ? `${doc.workerId.name} ${doc.workerId.lastName}`
        .toLowerCase()
        .includes(normalizedQuery)
    : false;
  const inEmpNum =
    (doc.workerId?.employeeNumber ?? "").toLowerCase().includes(normalizedQuery) ||
    (doc.parsedEmployeeNumber ?? "").toLowerCase().includes(normalizedQuery);

  return inFilename || inWorkerName || inEmpNum;
}
