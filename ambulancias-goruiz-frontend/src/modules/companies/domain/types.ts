export interface Company {
  _id: string;
  name: string;
  isActive: boolean;
  emailDomain?: string;
  enabledModules: string[];
  workerCount?: number;
  adminCount?: number;
}

export interface CompanyAdmin {
  _id: string;
  name: string;
  lastName: string;
  email: string;
}

export interface CreateCompanyInput {
  name: string;
  emailDomain?: string;
  enabledModules?: string[];
}

export interface UpdateCompanyInput {
  name?: string;
  isActive?: boolean;
  emailDomain?: string | null;
  enabledModules?: string[];
}

export interface CreateAdminInput {
  name: string;
  lastName: string;
  email: string;
  password: string;
}
