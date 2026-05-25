import mongoose from "mongoose";
import User from "../../users/models/user.model";
import Company from "../../companies/models/company.model";
import type { ModuleKey } from "../../companies/constants/modules.constants";
import { isSameCompany } from "../../../utils/requireCompany";

export type FilterPushRecipientsOptions = {
  /** Skip users whose company does not have this module enabled. */
  moduleKey?: ModuleKey;
  /** Skip users not in the acting admin's company (legacy null companyId excluded). */
  actingCompanyId?: string;
};

/**
 * Defense-in-depth filter for push recipients.
 * Does not replace domain validation in source modules.
 */
export async function filterPushRecipients(
  userIds: string[],
  options?: FilterPushRecipientsOptions,
): Promise<string[]> {
  if (userIds.length === 0) return [];

  const validIds = userIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (validIds.length === 0) return [];

  const users = await User.find({
    _id: { $in: validIds.map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select("_id companyId")
    .lean();

  let filtered = users;

  if (options?.actingCompanyId) {
    filtered = filtered.filter((user) =>
      isSameCompany(user.companyId, options.actingCompanyId),
    );
  }

  if (options?.moduleKey) {
    const companyIds = [
      ...new Set(
        filtered
          .map((user) => (user.companyId ? String(user.companyId) : null))
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const companies =
      companyIds.length > 0
        ? await Company.find({ _id: { $in: companyIds } })
            .select("enabledModules")
            .lean()
        : [];

    const modulesByCompany = new Map(
      companies.map((company) => [
        String(company._id),
        (company.enabledModules ?? []) as ModuleKey[],
      ]),
    );

    filtered = filtered.filter((user) => {
      const companyId = user.companyId ? String(user.companyId) : null;
      if (!companyId) return false;
      const enabled = modulesByCompany.get(companyId) ?? [];
      return enabled.includes(options.moduleKey as ModuleKey);
    });
  }

  return filtered.map((user) => String(user._id));
}
