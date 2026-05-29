import mongoose from "mongoose";
import SickLeave from "../models/sick-leave.model";
import {
  sendPushNotification,
  notifyUsersModuleGated,
  WS_EVENTS,
} from "../../notifications";
import { MODULE_KEYS } from "../../companies/constants/modules.constants";
import { findOverlappingActiveSickLeave } from "./sick-range.service";
import { validateSickDocumentStoredPath } from "../utils/sick-document.validation";

export async function createSickLeaveRecord(input: {
  userId: string;
  startDate: Date;
  endDate: Date;
  note?: string;
  documentUrl?: string;
  companyId?: string;
}) {
  const { userId, startDate, endDate, note, documentUrl, companyId } = input;

  const overlap = await findOverlappingActiveSickLeave({
    userId,
    startDate,
    endDate,
  });
  if (overlap) {
    return { kind: "overlap" as const };
  }

  let normalizedDocumentUrl: string | undefined;
  if (documentUrl) {
    const docValidation = validateSickDocumentStoredPath(documentUrl);
    if (!docValidation.ok) {
      return { kind: "invalid_document" as const, message: docValidation.message };
    }
    normalizedDocumentUrl = docValidation.normalized;
  }

  const doc = await SickLeave.create({
    user: new mongoose.Types.ObjectId(userId),
    startDate,
    endDate,
    status: "pending",
    note,
    documentUrl: normalizedDocumentUrl,
    ...(companyId && mongoose.Types.ObjectId.isValid(companyId) && {
      companyId: new mongoose.Types.ObjectId(companyId),
    }),
  });

  return { kind: "ok" as const, doc };
}

export async function assertNoOverlappingActiveSickLeave(params: {
  userId: string;
  startDate: Date;
  endDate: Date;
  excludingId?: string;
}) {
  const overlap = await findOverlappingActiveSickLeave(params);
  if (overlap) {
    return { ok: false as const, kind: "overlap" as const };
  }
  return { ok: true as const };
}

export async function getSickLeaveById(id: string) {
  return SickLeave.findById(id);
}

export async function rejectSickLeaveRecord(sick: any) {
  sick.status = "rejected";
  await sick.save();
  const userId = sick.user ? String(sick.user) : null;
  if (userId) {
    void sendPushNotification(
      [userId],
      "Baja rechazada",
      "Tu solicitud de baja no ha podido ser aceptada.",
      { type: "sick_leave_rejected", sickLeaveId: String(sick._id), screen: "sickLeaves" },
    );
    const companyId = sick.companyId ? String(sick.companyId) : null;
    if (companyId) {
      void notifyUsersModuleGated(
        [userId],
        WS_EVENTS.SICK_LEAVE_CHANGED,
        MODULE_KEYS.SICK_LEAVES,
        companyId,
      );
    }
  }
  return sick;
}

export async function deleteOwnRejectedSickLeave(input: { userId: string; id: string }) {
  const { userId, id } = input;
  const record = await SickLeave.findById(id);
  if (!record) return { kind: "not_found" as const };
  if (String(record.user) !== String(userId)) return { kind: "forbidden" as const };
  if (String(record.status) !== "rejected") return { kind: "invalid_status" as const };
  await SickLeave.findByIdAndDelete(id);
  return { kind: "ok" as const };
}
