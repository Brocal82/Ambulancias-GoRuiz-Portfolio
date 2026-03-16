import mongoose from "mongoose";
import SickLeave from "../models/sick-leave.model";

export async function createSickLeaveRecord(input: {
  userId: string;
  startDate: Date;
  endDate: Date;
  note?: string;
  documentUrl?: string;
}) {
  const { userId, startDate, endDate, note, documentUrl } = input;

  return SickLeave.create({
    user: new mongoose.Types.ObjectId(userId),
    startDate,
    endDate,
    status: "pending",
    note,
    documentUrl,
  });
}

export async function getSickLeaveById(id: string) {
  return SickLeave.findById(id);
}

export async function rejectSickLeaveRecord(sick: any) {
  sick.status = "rejected";
  await sick.save();
  return sick;
}
