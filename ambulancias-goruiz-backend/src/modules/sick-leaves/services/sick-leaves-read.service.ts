import mongoose from "mongoose";
import SickLeave from "../models/sick-leave.model";
import User from "../../users/models/user.model";

export async function getSickLeaves(input: {
  status?: string;
  user?: string;
  companyId?: string | null;
}) {
  const { status, user, companyId } = input;

  const raw = typeof companyId === "string" ? companyId.trim() : "";
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    return [];
  }

  const q: any = {};
  if (status && ["pending", "accepted", "rejected"].includes(status)) {
    q.status = status;
  }
  const userIds = await User.find({
    companyId: new mongoose.Types.ObjectId(raw),
  })
    .select("_id")
    .lean();
  const ids = userIds.map((u) => (u as unknown as { _id: mongoose.Types.ObjectId })._id);
  if (ids.length === 0) return [];
  if (user && mongoose.Types.ObjectId.isValid(user)) {
    const userObjId = new mongoose.Types.ObjectId(user);
    if (!ids.some((id: mongoose.Types.ObjectId) => id.equals(userObjId))) {
      return [];
    }
    q.user = userObjId;
  } else {
    q.user = { $in: ids };
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
