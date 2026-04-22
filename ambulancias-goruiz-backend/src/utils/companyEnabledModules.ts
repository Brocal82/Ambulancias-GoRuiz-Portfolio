import Company from "../modules/companies/models/company.model";

/**
 * Returns whether the company's enabledModules includes moduleKey.
 * false if company missing or enabledModules empty/missing.
 */
export async function companyHasEnabledModule(
  companyId: string,
  moduleKey: string,
): Promise<boolean> {
  const raw = String(companyId ?? "").trim();
  if (!raw) return false;
  const company = await Company.findById(raw).select("enabledModules").lean();
  if (!company) return false;
  const enabled: string[] = Array.isArray((company as { enabledModules?: string[] }).enabledModules)
    ? ((company as { enabledModules: string[] }).enabledModules as string[])
    : [];
  return enabled.includes(moduleKey);
}
