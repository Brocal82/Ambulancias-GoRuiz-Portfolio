// src/utils/mechanics/normalizeIssue.ts
import type { WorkdayIssue } from "../../workday/domain/types/workdayIssue";
/**
 * Normaliza un issue para asegurar defaults
 * cuando el backend aÃºn no envÃ­a ciertos campos.
 * NO cambia comportamiento, solo aÃ±ade valores seguros.
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
