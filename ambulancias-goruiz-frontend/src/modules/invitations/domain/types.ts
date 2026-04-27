export interface ValidateInvitationResponse {
  valid: boolean;
  email?: string;
  role?: "admin" | "worker" | "mecanico" | "jefe_mecanicos" | "jefe_logistica";
  companyName?: string;
  /** From API when invitation is worker and has a stored employee number. */
  employeeNumber?: string;
  reason?: string;
}

export interface AcceptInvitationInput {
  token: string;
  name: string;
  lastName: string;
  password: string;
}

export interface CreateInvitationPayload {
  email: string;
  role: "admin" | "worker" | "mecanico" | "jefe_mecanicos" | "jefe_logistica";
  expiresInDays?: number;
  employeeNumber?: string;
}

export interface CreateInvitationResponse {
  invitationId: string;
  token: string;
  expiresAt: string;
  email: string;
  role: "admin" | "worker" | "mecanico" | "jefe_mecanicos" | "jefe_logistica";
}
