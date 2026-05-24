export const STEP_UP_ACTION = {
  COMPANY_CREATE: "company.create",
  COMPANY_DELETE: "company.delete",
  COMPANY_SENSITIVE_UPDATE: "company.sensitive_update",
  COMPANY_ADMIN_CREATE: "company.admin.create",
  SUPPORT_ACCESS_APPROVE: "support_access.approve",
  SUPPORT_ACCESS_REVOKE: "support_access.revoke",
} as const;

export type StepUpAction = (typeof STEP_UP_ACTION)[keyof typeof STEP_UP_ACTION];
