import { clearUserFromDienstsInRange } from "../../../utils/dienstClearUtils";
import { calculateSickDocumentRequirements } from "../utils/sick-workflow.helpers";
import { toBerlinEndOfDay, toBerlinStartOfDay } from "../utils/sick-date.helpers";

export async function acceptSickLeaveWorkflow(sick: any) {
  const startDt = toBerlinStartOfDay(sick.startDate);
  const endDt = toBerlinEndOfDay(sick.endDate);

  if (endDt < startDt) {
    return { kind: "invalid_range" as const };
  }

  const { requiresDocument, verificationStatus, documentDueAt } =
    calculateSickDocumentRequirements({
      startDate: sick.startDate,
      endDate: sick.endDate,
      createdAt: sick.createdAt,
    });

  sick.status = "accepted";
  sick.requiresDocument = requiresDocument;
  sick.verificationStatus = verificationStatus;
  sick.documentDueAt = documentDueAt;
  await sick.save();

  const userIdStr = String(sick.user);
  const startISO = startDt.toISODate()!;
  const endISO = endDt.toISODate()!;

  try {
    await clearUserFromDienstsInRange({
      userId: userIdStr,
      startISO,
      endISO,
    });
  } catch (clearErr) {
    console.error(
      "\u26A0\uFE0F Error al desasignar usuario de Diensts tras aceptar baja:",
      clearErr,
    );
  }

  return {
    kind: "ok" as const,
    response: {
      message: "Baja aceptada y desasignaci\u00F3n aplicada",
      sickLeaveId: sick._id,
      requiresDocument,
      verificationStatus,
      documentDueAt,
      stats: {
        range: {
          startISO,
          endISO,
        },
      },
    },
  };
}
