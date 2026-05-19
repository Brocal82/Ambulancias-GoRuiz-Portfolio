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
  const companyOid = new mongoose.Types.ObjectId(raw);
  const userIds = await User.find({
    companyId: companyOid,
  })
    .select("_id")
    .lean();
  const ids = userIds.map((u) => (u as unknown as { _id: mongoose.Types.ObjectId })._id);
  if (user && mongoose.Types.ObjectId.isValid(user)) {
    q.user = new mongoose.Types.ObjectId(user);
  }
  q.$or = [
    { companyId: companyOid },
    { companyId: null, user: { $in: ids } },
  ];

  return SickLeave.find(q)
    .sort({ createdAt: -1 })
    .populate("user", "name lastName email ambulanceRole")
    .lean();
}

export async function countSickLeavesByStatus(
  status: string,
  companyId?: string | null,
): Promise<number> {
  const raw = typeof companyId === "string" ? companyId.trim() : "";
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    return 0;
  }

  const q: Record<string, unknown> = {};
  if (["pending", "accepted", "rejected"].includes(status)) {
    q.status = status;
  }

  const companyOid = new mongoose.Types.ObjectId(raw);
  const userIds = await User.find({ companyId: companyOid }).select("_id").lean();
  const ids = userIds.map(
    (u) => (u as unknown as { _id: mongoose.Types.ObjectId })._id,
  );
  q.$or = [
    { companyId: companyOid },
    { companyId: null, user: { $in: ids } },
  ];

  return SickLeave.countDocuments(q);
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
