export type DocumentsTabKey = "payroll" | "toConfirm" | "informative";

export function resolveInitialDocumentsTab(
  hasPayrollModule: boolean,
  hasCompanyDocumentsModule: boolean,
): DocumentsTabKey {
  if (hasPayrollModule && !hasCompanyDocumentsModule) return "payroll";
  if (hasCompanyDocumentsModule && !hasPayrollModule) return "toConfirm";
  return "payroll";
}
