import mongoose from "mongoose";
import SickLeave from "../models/sick-leave.model";
import { sendPushNotification } from "../../notifications";

export async function createSickLeaveRecord(input: {
  userId: string;
  startDate: Date;
  endDate: Date;
  note?: string;
  documentUrl?: string;
  companyId?: string;
}) {
  const { userId, startDate, endDate, note, documentUrl, companyId } = input;

  return SickLeave.create({
    user: new mongoose.Types.ObjectId(userId),
    startDate,
    endDate,
    status: "pending",
    note,
    documentUrl,
    ...(companyId && mongoose.Types.ObjectId.isValid(companyId) && {
      companyId: new mongoose.Types.ObjectId(companyId),
    }),
  });
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
      { type: "sick_leave_rejected", sickLeaveId: String(sick._id) },
    );
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
