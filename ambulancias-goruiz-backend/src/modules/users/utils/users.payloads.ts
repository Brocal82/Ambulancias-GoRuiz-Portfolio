export type AmbulanceRole = "driver" | "medic" | "both";

export interface UpdateUserDTO {
  name: string;
  lastName?: string;
  email: string;

  ambulanceRole?: AmbulanceRole;
  address?: string;
  phone?: string;
  emergencyPhone?: string;
  pscheinExpiry?: string;

  pscheinConfirmedAt?: Date | null;
  pscheinConfirmedBy?: string | null;
  pscheinDocumentPath?: string;

  /**
   * - string normal: set
   * - "" : borrar
   * - undefined: no tocar
   */
  profileImage?: string;

  employeeNumber?: string;

  // docs lo gestiona uploadUserFiles, no updateUser
  // documents?: string[];
}

export interface CreateUserDTO {
  name: string;
  lastName: string;
  email: string;
  password: string;
  role?: "admin" | "worker"; // por defecto worker
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface LoginResponseDTO {
  message: string;
  token: string;
  user: {
    _id: string;
    name: string;
    lastName: string;
    email: string;
    role: "admin" | "worker" | "superadmin";
    ambulanceRole?: AmbulanceRole;
    pscheinExpiry?: string;
    address?: string;
    phone?: string;
    emergencyPhone?: string;
    profileImage?: string;
    companyId?: string;
  };
}
