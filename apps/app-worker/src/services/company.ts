import { CompanyModuleKey } from "../types/auth";
import { apiRequest } from "./http";

type CompanyResponse = {
  _id: string;
  enabledModules?: string[];
  praemienMode?: "automatic" | "manual";
  praemienModeEffectiveFrom?: { year: number; month: number } | null;
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

export type CompanyPraemienConfig = {
  praemienMode?: "automatic" | "manual";
  praemienModeEffectiveFrom?: { year: number; month: number } | null;
};

export async function getMyCompanyPraemienConfig(
  authToken?: string,
): Promise<CompanyPraemienConfig> {
  const company = await apiRequest<CompanyResponse>("/companies/me", {
    method: "GET",
    requiresAuth: true,
    authToken,
  });
  return {
    praemienMode: company.praemienMode,
    praemienModeEffectiveFrom: company.praemienModeEffectiveFrom ?? null,
  };
}
