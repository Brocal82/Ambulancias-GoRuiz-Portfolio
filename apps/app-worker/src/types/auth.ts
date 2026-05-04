export type UserRole =
  | "worker"
  | "admin"
  | "superadmin"
  | "mecanico"
  | "jefe_mecanicos"
  | "jefe_logistica";

export type AmbulanceRole = "driver" | "medic" | "both" | null;

export interface AuthUser {
  _id: string;
  name: string;
  lastName: string;
  email: string;
  role: UserRole;
  ambulanceRole?: AmbulanceRole;
  companyId?: string;
  employeeNumber?: string;
  pscheinExpiry?: string;
  pscheinConfirmedAt?: string;
  pscheinConfirmedBy?: string;
  pscheinDocument?: string;
  address?: string;
  phone?: string;
  emergencyPhone?: string;
  profileImage?: string;
}

export interface LoginRequestDTO {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface LoginResponseDTO {
  message: string;
  token: string;
  user: AuthUser;
}

export interface ApiErrorPayload {
  message?: string;
  code?: string;
}

export const MODULE_KEYS = {
  SCHEDULING: "scheduling",
  EXCEL_PLANNING: "excel-planning",
  WORKDAY: "workday",
  AMBULANCES: "ambulances",
  MESSAGES: "messages",
  PAYROLL: "payroll",
  DOCUMENTS: "documents",
  PRAEMIEN: "praemien",
} as const;

export type CompanyModuleKey = (typeof MODULE_KEYS)[keyof typeof MODULE_KEYS];

export type ScheduleSource = "dynamic" | "excel" | "none";
