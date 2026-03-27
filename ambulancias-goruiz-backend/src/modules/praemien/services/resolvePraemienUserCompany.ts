import mongoose from "mongoose";
import User from "../../users/models/user.model";

/**
 * Company ObjectId for Praemien WorkdaySummary scoping. Throws if user has no company.
 */
export async function getCompanyObjectIdForPraemienUser(
  userId: string,
): Promise<mongoose.Types.ObjectId> {
  const userDoc = await User.findById(userId).select("companyId").lean();
  const co = userDoc ? (userDoc as { companyId?: unknown }).companyId : null;
  if (!co) {
    throw new Error(
      "No se pueden calcular praemien: el usuario no está asociado a una empresa.",
    );
  }
  return new mongoose.Types.ObjectId(String(co));
}
