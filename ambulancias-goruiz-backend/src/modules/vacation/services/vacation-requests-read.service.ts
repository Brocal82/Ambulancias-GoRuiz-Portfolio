import mongoose from "mongoose";
import VacationRequest from "../models/vacation-request.model";
import User from "../../users/models/user.model";

export async function getAllVacationRequests(companyId?: string | null) {
  const filter: Record<string, unknown> = {};
  if (companyId && companyId.trim() !== "") {
    const userIds = await User.find({
      companyId: new mongoose.Types.ObjectId(companyId),
    })
      .select("_id")
      .lean();
    const ids = userIds.map((u) => (u as unknown as { _id: mongoose.Types.ObjectId })._id);
    if (ids.length === 0) return [];
    filter.user = { $in: ids };
  }
  return VacationRequest.find(filter).populate("user", "name lastName email");
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
  const filter: Record<string, unknown> = { status };
  if (companyId && companyId.trim() !== "") {
    const userIds = await User.find({
      companyId: new mongoose.Types.ObjectId(companyId),
    })
      .select("_id")
      .lean();
    const ids = userIds.map((u) => (u as unknown as { _id: mongoose.Types.ObjectId })._id);
    if (ids.length === 0) return 0;
    filter.user = { $in: ids };
  }
  return VacationRequest.countDocuments(filter);
}
