import mongoose from "mongoose";
import User from "../../users/models/user.model";

export type PayrollReadinessStatus = "READY" | "WARNING";

export interface PayrollReadinessSummary {
  payrollWorkers: number;
  missingEmployeeNumbers: number;
  duplicateEmployeeNumbers: number;
  readiness: PayrollReadinessStatus;
}

function isMissingEmployeeNumber(value: string | undefined | null): boolean {
  if (value == null) return true;
  return value.trim() === "";
}

/**
 * Phase 1 — visibility only. Computes payroll identity readiness from active
 * payroll-scope workers (role worker, isActive) without exposing personal data.
 */
export function computePayrollReadinessFromWorkers(
  workers: Array<{ employeeNumber?: string | null }>,
): PayrollReadinessSummary {
  const payrollWorkers = workers.length;
  const missingEmployeeNumbers = workers.filter((w) =>
    isMissingEmployeeNumber(w.employeeNumber),
  ).length;

  const countsByNumber = new Map<string, number>();
  for (const worker of workers) {
    if (isMissingEmployeeNumber(worker.employeeNumber)) continue;
    const key = worker.employeeNumber!.trim();
    countsByNumber.set(key, (countsByNumber.get(key) ?? 0) + 1);
  }

  let duplicateEmployeeNumbers = 0;
  for (const count of countsByNumber.values()) {
    if (count > 1) duplicateEmployeeNumbers++;
  }

  const readiness: PayrollReadinessStatus =
    missingEmployeeNumbers > 0 || duplicateEmployeeNumbers > 0
      ? "WARNING"
      : "READY";

  return {
    payrollWorkers,
    missingEmployeeNumbers,
    duplicateEmployeeNumbers,
    readiness,
  };
}

/**
 * Same worker scope as payroll coverage and auto-match: active workers in the
 * admin's company with role "worker".
 */
export async function getPayrollReadinessForCompany(
  companyId: string,
): Promise<PayrollReadinessSummary> {
  const companyOid = new mongoose.Types.ObjectId(companyId);
  const workers = (await User.find({
    companyId: companyOid,
    role: "worker",
    isActive: true,
  })
    .select("employeeNumber")
    .lean()) as Array<{ employeeNumber?: string | null }>;

  return computePayrollReadinessFromWorkers(workers);
}
