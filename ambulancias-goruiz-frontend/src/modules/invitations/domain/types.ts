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
