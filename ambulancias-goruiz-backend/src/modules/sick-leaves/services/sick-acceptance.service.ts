import mongoose from "mongoose";
import { clearUserFromDienstsInRange } from "../../../utils/dienstClearUtils";
import { calculateSickDocumentRequirements } from "../utils/sick-workflow.helpers";
import { toBerlinEndOfDay, toBerlinStartOfDay } from "../utils/sick-date.helpers";
import { sendPushNotification, notifyUsersModuleGated, WS_EVENTS } from "../../notifications";
import { MODULE_KEYS } from "../../companies/constants/modules.constants";

/** Resolves user id whether `user` is an ObjectId, string id, or populated { _id, ... }. */
export function resolveSickUserId(user: unknown): string | null {
  if (user == null) return null;
  if (typeof user === "string") {
    return mongoose.Types.ObjectId.isValid(user) ? user : null;
  }
  if (user instanceof mongoose.Types.ObjectId) {
    return user.toString();
  }
  if (typeof user === "object" && user !== null && "_id" in user) {
    const id = (user as { _id: unknown })._id;
    if (id instanceof mongoose.Types.ObjectId) return id.toString();
    if (typeof id === "string" && mongoose.Types.ObjectId.isValid(id)) return id;
  }
  return null;
}

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

  const userIdStr = resolveSickUserId(sick.user);
  const startISO = startDt.toISODate()!;
  const endISO = endDt.toISODate()!;

  try {
    if (userIdStr) {
      await clearUserFromDienstsInRange({
        userId: userIdStr,
        startISO,
        endISO,
      });
    }
  } catch (clearErr) {
    console.error("[CLEARING_ERROR]", {
      flow: "sick_admin_accept",
      entityId: String(sick._id),
      userId: userIdStr ?? "",
      startISO,
      endISO,
      error:
        clearErr instanceof Error ? clearErr.message : String(clearErr),
      stack: clearErr instanceof Error ? clearErr.stack : undefined,
    });
  }

  if (userIdStr) {
    void sendPushNotification(
      [userIdStr],
      "Baja aceptada",
      "Tu solicitud de baja ha sido aceptada.",
      { type: "sick_leave_accepted", sickLeaveId: String(sick._id), screen: "sickLeaves" },
    );
    const companyId = sick.companyId ? String(sick.companyId) : null;
    if (companyId) {
      void notifyUsersModuleGated(
        [userIdStr],
        WS_EVENTS.SICK_LEAVE_CHANGED,
        MODULE_KEYS.SICK_LEAVES,
        companyId,
      );
    }
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
