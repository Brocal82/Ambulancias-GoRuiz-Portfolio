import mongoose from "mongoose";
import User from "../../users/models/user.model";
import Company from "../../companies/models/company.model";

export type EffectiveManualContext =
  | { isEffectiveManual: false }
  | {
      isEffectiveManual: true;
      companyObjectId: mongoose.Types.ObjectId;
      effectiveFrom: { year: number; month: number };
    };

/**
 * Whether the user's company is in **effective** manual Prämien mode
 * (same calendar rule as manual daily APIs).
 */
export async function getEffectiveManualPraemienContextForUser(
  userId: string,
): Promise<EffectiveManualContext> {
  const userDoc = await User.findById(userId).select("companyId").lean();
  const co = userDoc ? (userDoc as { companyId?: unknown }).companyId : null;
  if (!co) {
    return { isEffectiveManual: false };
  }

  const companyIdStr = String(co);
  if (!mongoose.Types.ObjectId.isValid(companyIdStr)) {
    return { isEffectiveManual: false };
  }

  const company = await Company.findById(companyIdStr)
    .select("praemienMode praemienModeEffectiveFrom")
    .lean();

  if (!company) {
    return { isEffectiveManual: false };
  }

  const mode = company.praemienMode ?? "automatic";
  if (mode !== "manual") {
    return { isEffectiveManual: false };
  }

  const from = company.praemienModeEffectiveFrom;
  if (
    !from ||
    typeof from.year !== "number" ||
    typeof from.month !== "number" ||
    from.month < 1 ||
    from.month > 12
  ) {
    return { isEffectiveManual: false };
  }

  const effectiveStart = new Date(from.year, from.month - 1, 1);
  effectiveStart.setHours(0, 0, 0, 0);
  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  if (todayStart < effectiveStart) {
    return { isEffectiveManual: false };
  }

  return {
    isEffectiveManual: true,
    companyObjectId: new mongoose.Types.ObjectId(companyIdStr),
    effectiveFrom: { year: from.year, month: from.month },
  };
}

export function calendarMonthKey(year: number, month1to12: number): number {
  return year * 12 + month1to12;
}
