// src/utils/mechanics/sortIssuesByDateDesc.ts
import type { WorkdayIssue } from "../domain/types";
/**
 * Ordena aver­as por timestamp descendente (m¡s recientes primero).
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
