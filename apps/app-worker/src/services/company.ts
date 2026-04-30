import { CompanyModuleKey } from "../types/auth";
import { apiRequest } from "./http";

type CompanyResponse = {
  _id: string;
  enabledModules?: string[];
};

export async function getMyCompanyModules(
  authToken?: string,
): Promise<CompanyModuleKey[]> {
  const company = await apiRequest<CompanyResponse>("/companies/me", {
    method: "GET",
    requiresAuth: true,
    authToken,
  });
  return (company.enabledModules ?? []) as CompanyModuleKey[];
}
