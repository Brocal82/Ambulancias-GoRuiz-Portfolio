export interface Company {
  _id: string;
  name: string;
  isActive: boolean;
}

export interface CreateCompanyInput {
  name: string;
}

export interface UpdateCompanyInput {
  name?: string;
  isActive?: boolean;
}

export interface CreateAdminInput {
  name: string;
  lastName: string;
  email: string;
  password: string;
}
