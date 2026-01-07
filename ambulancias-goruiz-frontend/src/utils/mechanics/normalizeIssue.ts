// src/utils/mechanics/normalizeIssue.ts
import type { WorkdayIssue } from "../../types/workdayIssue";

/**
 * Normaliza un issue para asegurar defaults
 * cuando el backend aún no envía ciertos campos.
 * NO cambia comportamiento, solo añade valores seguros.
 */
export function normalizeIssue(issue: WorkdayIssue): WorkdayIssue {
  return {
    ...issue,
    isSeen: issue.isSeen ?? false,
    seenAt: issue.seenAt ?? null,
  };
}

/**
 * Normaliza una lista de issues
 */
export function normalizeIssues(
  issues: WorkdayIssue[],
): WorkdayIssue[] {
  return issues.map(normalizeIssue);
}
