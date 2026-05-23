/** Worker appointment API paths — keep aligned with backend routes */
export const APPOINTMENT_API_PATHS = {
  my: "/appointments/my",
  requests: "/appointments/requests",
  select: (id: string) => `/appointments/${id}/select`,
  rejectProposal: (id: string) => `/appointments/${id}/reject-proposal`,
  requestCancel: (id: string) => `/appointments/${id}/request-cancel`,
  deleteMy: (id: string) => `/appointments/${id}/my`,
} as const;

export type AppointmentApiPath =
  (typeof APPOINTMENT_API_PATHS)[keyof typeof APPOINTMENT_API_PATHS];
