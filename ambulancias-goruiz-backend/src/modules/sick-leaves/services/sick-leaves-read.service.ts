import mongoose from "mongoose";
import SickLeave from "../models/sick-leave.model";

export async function getSickLeaves(input: { status?: string; user?: string }) {
  const { status, user } = input;

  const q: any = {};
  if (status && ["pending", "accepted", "rejected"].includes(status)) {
    q.status = status;
  }
  if (user && mongoose.Types.ObjectId.isValid(user)) {
    q.user = new mongoose.Types.ObjectId(user);
  }

  return SickLeave.find(q)
    .sort({ createdAt: -1 })
    .populate("user", "name lastName email ambulanceRole")
    .lean();
}

export async function getMySickLeaves(input: {
  userId: string;
  status?: string;
}) {
  const { userId, status } = input;

  const q: any = { user: new mongoose.Types.ObjectId(userId) };
  if (status && ["pending", "accepted", "rejected"].includes(status)) {
    q.status = status;
  }

  return SickLeave.find(q).sort({ createdAt: -1 }).lean();
}
