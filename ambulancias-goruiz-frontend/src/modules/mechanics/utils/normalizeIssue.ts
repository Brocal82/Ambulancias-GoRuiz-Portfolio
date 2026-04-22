// src/utils/mechanics/normalizeIssue.ts
import type { MechanicsIssue } from "../domain/types";
/**
 * Normaliza un issue para asegurar defaults
 * cuando el backend aºn no env­a ciertos campos.
 * NO cambia comportamiento, solo a±ade valores seguros.
 */
export function normalizeIssue(issue: MechanicsIssue): MechanicsIssue {
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
  issues: MechanicsIssue[],
): MechanicsIssue[] {
  return issues.map(normalizeIssue);
}
