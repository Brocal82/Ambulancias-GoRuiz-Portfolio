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
  /** Ruta del PDF P-Schein; null limpia el certificado en BD */
  pscheinDocument?: string | null;

  /**
   * - string normal: set
   * - "" : borrar
   * - undefined: no tocar
   */
  profileImage?: string;

  employeeNumber?: string;
  /**
   * Set to false to deactivate a worker (prevents login, excludes from
   * payroll coverage and auto-matching after Phase 7b).
   * Only admins of the same company can change this field.
   */
  isActive?: boolean;
}

export interface CreateUserDTO {
  name: string;
  lastName: string;
  email: string;
  password: string;
  role?: "admin" | "worker" | "mecanico" | "jefe_mecanicos" | "jefe_logistica"; // por defecto worker
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
    role:
      | "admin"
      | "worker"
      | "mecanico"
      | "jefe_mecanicos"
      | "jefe_logistica"
      | "superadmin";
    ambulanceRole?: AmbulanceRole;
    pscheinExpiry?: string;
    address?: string;
    phone?: string;
    emergencyPhone?: string;
    profileImage?: string;
    companyId?: string;
  };
}
