// backend/src/modules/users/payloads.ts

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

  /**
   * - string normal: set
   * - "" : borrar
   * - undefined: no tocar
   */
  profileImage?: string;

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

