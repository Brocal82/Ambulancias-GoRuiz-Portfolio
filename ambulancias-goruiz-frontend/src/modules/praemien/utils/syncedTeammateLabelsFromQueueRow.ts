import type { AdminManualPraemieQueueRowData } from "../domain/manualDailyApi";

function formatSeatName(lastName: string, name: string): string {
  return `${lastName}, ${name}`.trim().replace(/^,\s*|,\s*$/g, "") || "";
}

/** Nombres del compañero de Dienst aprobado en cascada (si coincide con la fila). */
export function syncedTeammateLabelsFromQueueRow(
  row: AdminManualPraemieQueueRowData,
  syncedUserIds: string[],
): string[] {
  const labels: string[] = [];
  for (const id of syncedUserIds) {
    if (row.equipoDriverUserId === id) {
      const label = formatSeatName(row.equipoDriverLastName, row.equipoDriverName);
      if (label) labels.push(label);
    } else if (row.equipoMedicUserId === id) {
      const label = formatSeatName(row.equipoMedicLastName, row.equipoMedicName);
      if (label) labels.push(label);
    }
  }
  return labels;
}
