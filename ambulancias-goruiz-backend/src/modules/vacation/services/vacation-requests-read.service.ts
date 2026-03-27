import mongoose from "mongoose";
import VacationRequest from "../models/vacation-request.model";
import User from "../../users/models/user.model";

export async function getAllVacationRequests(companyId?: string | null) {
  const raw = typeof companyId === "string" ? companyId.trim() : "";
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    return [];
  }
  const userIds = await User.find({
    companyId: new mongoose.Types.ObjectId(raw),
  })
    .select("_id")
    .lean();
  const ids = userIds.map((u) => (u as unknown as { _id: mongoose.Types.ObjectId })._id);
  if (ids.length === 0) return [];
  return VacationRequest.find({ user: { $in: ids } }).populate(
    "user",
    "name lastName email",
  );
}

export async function getVacationRequestsForUser(userId: string) {
  return VacationRequest.find({ user: userId }).populate(
    "user",
    "name lastName email",
  );
}

export async function countVacationRequestsByStatus(
  status: string,
  companyId?: string | null,
) {
  const raw = typeof companyId === "string" ? companyId.trim() : "";
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    return 0;
  }
  const userIds = await User.find({
    companyId: new mongoose.Types.ObjectId(raw),
  })
    .select("_id")
    .lean();
  const ids = userIds.map((u) => (u as unknown as { _id: mongoose.Types.ObjectId })._id);
  if (ids.length === 0) return 0;
  return VacationRequest.countDocuments({ status, user: { $in: ids } });
}
