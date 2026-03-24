import axios from "../../../api/axios";
import type {
  Company,
  CreateCompanyInput,
  UpdateCompanyInput,
  CreateAdminInput,
} from "./types";

export const getCompanies = async (): Promise<Company[]> => {
  const res = await axios.get<Company[]>("/companies");
  return res.data;
};

export const getCompanyById = async (id: string): Promise<Company> => {
  const res = await axios.get<Company>(`/companies/${id}`);
  return res.data;
};

export const createCompany = async (data: CreateCompanyInput): Promise<Company> => {
  const res = await axios.post<Company>("/companies", data);
  return res.data;
};

export const updateCompany = async (
  id: string,
  data: UpdateCompanyInput,
): Promise<Company> => {
  const res = await axios.patch<Company>(`/companies/${id}`, data);
  return res.data;
};

export const createCompanyAdmin = async (
  companyId: string,
  data: CreateAdminInput,
) => {
  const res = await axios.post(`/companies/${companyId}/admin`, data);
  return res.data;
};
