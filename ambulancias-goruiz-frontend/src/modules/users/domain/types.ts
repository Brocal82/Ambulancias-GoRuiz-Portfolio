// frontend/src/types/user.ts
export type AmbulanceRole = "driver" | "medic" | "both";
export type AppRole = "admin" | "worker" | "superadmin";

export interface User {
  _id: string;
  name: string;
  lastName: string;
  email: string;
  role: AppRole;
  companyId?: string;
  employeeNumber?: string;
  ambulanceRole?: AmbulanceRole;
  pscheinExpiry?: string;
  pscheinConfirmedAt?: string;
  pscheinConfirmedBy?: string;
  pscheinDocument?: string;
  address?: string;
  phone?: string;
  emergencyPhone?: string;
  profileImage?: string;

  onLeave?: boolean;
  onVacation?: boolean;

  rotationMode?: "rotating" | "fixed" | "none";
  fixedDienstNumber?: number | null;
}
