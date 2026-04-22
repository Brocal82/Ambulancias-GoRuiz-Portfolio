import mongoose from "mongoose";
import User from "../../users/models/user.model";
import type { ManualDailyEntryDto } from "./praemien-manual-daily-mapper";

function userLabel(u: { name?: string; lastName?: string }): string {
  const a = (u.name ?? "").trim();
  const b = (u.lastName ?? "").trim();
  return [a, b].filter(Boolean).join(" ").trim();
}

/**
 * Rellena `adminReviewedByName` a partir de User (una consulta por lote).
 */
export async function enrichManualDailyDtosWithAdminNames(
  entries: ManualDailyEntryDto[],
): Promise<ManualDailyEntryDto[]> {
  const idSet = new Set<string>();
  for (const e of entries) {
    if (
      e.adminReviewedBy &&
      mongoose.Types.ObjectId.isValid(e.adminReviewedBy)
    ) {
      idSet.add(e.adminReviewedBy);
    }
  }
  if (idSet.size === 0) {
    return entries.map((e) => ({ ...e, adminReviewedByName: null }));
  }

  const oids = [...idSet].map((id) => new mongoose.Types.ObjectId(id));
  const users = await User.find({ _id: { $in: oids } })
    .select("name lastName")
    .lean();

  const byId = new Map<string, string>();
  for (const u of users) {
    const label = userLabel(u as { name?: string; lastName?: string });
    if (label) byId.set(String(u._id), label);
  }

  return entries.map((e) => ({
    ...e,
    adminReviewedByName: e.adminReviewedBy
      ? byId.get(e.adminReviewedBy) ?? null
      : null,
  }));
}

export async function enrichManualDailyDto(
  entry: ManualDailyEntryDto,
): Promise<ManualDailyEntryDto> {
  const [out] = await enrichManualDailyDtosWithAdminNames([entry]);
  return out;
}
