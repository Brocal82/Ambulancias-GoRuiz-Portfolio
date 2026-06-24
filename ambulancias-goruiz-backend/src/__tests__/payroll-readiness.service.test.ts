/**
 * Payroll identity readiness — Phase 1 (visibility only).
 */
import { computePayrollReadinessFromWorkers } from "../modules/payroll/services/payroll-readiness.service";

describe("computePayrollReadinessFromWorkers", () => {
  it("returns READY for a clean company", () => {
    const result = computePayrollReadinessFromWorkers([
      { employeeNumber: "EMP0001" },
      { employeeNumber: "EMP0002" },
      { employeeNumber: "EMP0003" },
    ]);

    expect(result).toEqual({
      payrollWorkers: 3,
      missingEmployeeNumbers: 0,
      duplicateEmployeeNumbers: 0,
      readiness: "READY",
    });
  });

  it("counts missing employee numbers", () => {
    const result = computePayrollReadinessFromWorkers([
      { employeeNumber: "EMP0001" },
      { employeeNumber: null },
      { employeeNumber: "" },
      { employeeNumber: "   " },
    ]);

    expect(result.payrollWorkers).toBe(4);
    expect(result.missingEmployeeNumbers).toBe(3);
    expect(result.duplicateEmployeeNumbers).toBe(0);
    expect(result.readiness).toBe("WARNING");
  });

  it("counts duplicate employee numbers within the worker set", () => {
    const result = computePayrollReadinessFromWorkers([
      { employeeNumber: "EMP0001" },
      { employeeNumber: "EMP0001" },
      { employeeNumber: "EMP0002" },
      { employeeNumber: "EMP0002" },
      { employeeNumber: "EMP0003" },
    ]);

    expect(result.payrollWorkers).toBe(5);
    expect(result.missingEmployeeNumbers).toBe(0);
    expect(result.duplicateEmployeeNumbers).toBe(2);
    expect(result.readiness).toBe("WARNING");
  });

  it("ignores missing numbers when detecting duplicates", () => {
    const result = computePayrollReadinessFromWorkers([
      { employeeNumber: null },
      { employeeNumber: "" },
      { employeeNumber: "EMP0001" },
    ]);

    expect(result.missingEmployeeNumbers).toBe(2);
    expect(result.duplicateEmployeeNumbers).toBe(0);
    expect(result.readiness).toBe("WARNING");
  });
});
