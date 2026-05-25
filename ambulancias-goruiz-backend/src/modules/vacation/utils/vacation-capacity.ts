import { startOfDay, addDays } from "date-fns";
import mongoose, { Model, Types } from "mongoose";
import User from "../../users/models/user.model";

interface VacationDoc {
  _id: Types.ObjectId;
  startDate: Date | string;
  endDate: Date | string;
  status: "pending" | "accepted" | "cancelled" | "option_sent";
}

export async function findOverCapacityDays(
  VacationModel: Model<any>,
  startISO: string | Date,
  endISO: string | Date,
  maxPerDay: number,
  companyId: string,
  excludingId?: string,
): Promise<string[]> {
  if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
    return [];
  }

  const members = await User.find({
    companyId: new mongoose.Types.ObjectId(companyId),
  })
    .select("_id")
    .lean();
  const memberIds = members.map((u) => u._id);

  const start = startOfDay(new Date(startISO));
  const end = startOfDay(new Date(endISO));

  const over: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const dayStart = startOfDay(d);
    const dayEnd = addDays(dayStart, 1);

    const query: Record<string, unknown> = {
      status: "accepted",
      startDate: { $lt: dayEnd },
      endDate: { $gte: dayStart },
      user: { $in: memberIds },
    };
    if (excludingId) query._id = { $ne: new Types.ObjectId(excludingId) };

    const count = await VacationModel.countDocuments(query).exec();
    if (count >= maxPerDay) {
      over.push(dayStart.toISOString());
    }
  }
  return over;
}
