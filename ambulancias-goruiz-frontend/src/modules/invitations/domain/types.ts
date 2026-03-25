export interface ValidateInvitationResponse {
  valid: boolean;
  email?: string;
  role?: "admin" | "worker";
  companyName?: string;
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
  role: "admin" | "worker";
  expiresInDays?: number;
  employeeNumber?: string;
}

export interface CreateInvitationResponse {
  invitationId: string;
  token: string;
  expiresAt: string;
  email: string;
  role: "admin" | "worker";
}
