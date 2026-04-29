export const STEP_UP_ACTION = {
  COMPANY_DELETE: "company.delete",
  COMPANY_SENSITIVE_UPDATE: "company.sensitive_update",
  COMPANY_ADMIN_CREATE: "company.admin.create",
} as const;

export type StepUpAction = (typeof STEP_UP_ACTION)[keyof typeof STEP_UP_ACTION];
