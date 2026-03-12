// src/utils/mechanics/sortIssuesByDateDesc.ts
import type { WorkdayIssue } from "../../workday/domain/types/workdayIssue";
/**
 * Ordena averÃ­as por timestamp descendente (mÃ¡s recientes primero).
 * Helper puro, sin efectos secundarios.
 */
export function sortIssuesByDateDesc(
  issues: WorkdayIssue[],
): WorkdayIssue[] {
  return [...issues].sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}
