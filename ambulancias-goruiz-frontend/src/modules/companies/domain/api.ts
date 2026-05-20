import axios from "../../../api/axios";
import type {
  Company,
  CompanyAdmin,
  CompanyMetrics,
  CompanySummary,
  CompanyUsersResponse,
  CreateCompanyInput,
  GlobalSuperadminMetrics,
  UpdateCompanyInput,
  CreateAdminInput,
} from "./types";

export const getGlobalSuperadminMetrics = async (): Promise<GlobalSuperadminMetrics> => {
  const res = await axios.get<GlobalSuperadminMetrics>("/companies/metrics/global");
  return res.data;
};

export const getCompanyMetrics = async (companyId: string): Promise<CompanyMetrics> => {
  const res = await axios.get<CompanyMetrics>(`/companies/${companyId}/metrics`);
  return res.data;
};

export const getCompanies = async (): Promise<Company[]> => {
  const res = await axios.get<Company[]>("/companies");
  return res.data;
};

export const getCompanyById = async (id: string): Promise<Company> => {
  const res = await axios.get<Company>(`/companies/${id}`);
  return res.data;
};

export const getCompanySummary = async (id: string): Promise<CompanySummary> => {
  const res = await axios.get<CompanySummary>(`/companies/${id}/summary`);
  return res.data;
};

export const getCompanyUsers = async (
  companyId: string,
  params?: { role?: string; isActive?: boolean; limit?: number; skip?: number },
): Promise<CompanyUsersResponse> => {
  const search = new URLSearchParams();
  if (params?.role) search.set("role", params.role);
  if (params?.isActive === true || params?.isActive === false) {
    search.set("isActive", String(params.isActive));
  }
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.skip != null) search.set("skip", String(params.skip));
  const q = search.toString();
  const res = await axios.get<CompanyUsersResponse>(
    `/companies/${companyId}/users${q ? `?${q}` : ""}`,
  );
  return res.data;
};

export const getMyCompany = async (): Promise<Company> => {
  const res = await axios.get<Company>("/companies/me");
  return res.data;
};

export const createCompany = async (
  data: CreateCompanyInput,
  stepUpToken?: string,
): Promise<Company> => {
  const res = await axios.post<Company>("/companies", data, {
    headers: stepUpToken ? { "x-step-up-token": stepUpToken } : undefined,
  });
  return res.data;
};

export const updateCompany = async (
  id: string,
  data: UpdateCompanyInput,
  stepUpToken?: string,
): Promise<Company> => {
  const res = await axios.patch<Company>(`/companies/${id}`, data, {
    headers: stepUpToken ? { "x-step-up-token": stepUpToken } : undefined,
  });
  return res.data;
};

export const deleteCompany = async (id: string, stepUpToken?: string): Promise<void> => {
  await axios.delete(`/companies/${id}`, {
    headers: stepUpToken ? { "x-step-up-token": stepUpToken } : undefined,
  });
};

export const getCompanyAdmins = async (companyId: string): Promise<CompanyAdmin[]> => {
  const res = await axios.get<CompanyAdmin[]>(`/companies/${companyId}/admins`);
  return res.data;
};

export const createCompanyAdmin = async (
  companyId: string,
  data: CreateAdminInput,
  stepUpToken?: string,
) => {
  const res = await axios.post(`/companies/${companyId}/admin`, data, {
    headers: stepUpToken ? { "x-step-up-token": stepUpToken } : undefined,
  });
  return res.data;
};

import type { CreateCompanyAdminInvitationResponse } from "./types";

export type CreateCompanyAdminInvitationInput = {
  email: string;
  expiresInDays?: number;
};

export const createCompanyAdminInvitation = async (
  companyId: string,
  data: CreateCompanyAdminInvitationInput,
  stepUpToken?: string,
): Promise<CreateCompanyAdminInvitationResponse> => {
  const res = await axios.post<CreateCompanyAdminInvitationResponse>(
    `/companies/${companyId}/admin/invitation`,
    data,
    {
      headers: stepUpToken ? { "x-step-up-token": stepUpToken } : undefined,
    },
  );
  return res.data;
};
