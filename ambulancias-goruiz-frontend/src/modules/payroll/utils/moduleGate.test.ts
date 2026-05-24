import { describe, it, expect } from "vitest";
import { MODULE_KEYS } from "../../../constants/modules";

/** Mirrors RequireModule(name="payroll") — payroll routes need this module. */
export function isPayrollModuleRouteEnabled(
  enabledModules: string[],
): boolean {
  return enabledModules.includes(MODULE_KEYS.PAYROLL);
}

describe("payroll module gate", () => {
  it("habilita rutas solo con módulo payroll", () => {
    expect(isPayrollModuleRouteEnabled([MODULE_KEYS.PAYROLL])).toBe(true);
    expect(isPayrollModuleRouteEnabled([MODULE_KEYS.DOCUMENTS])).toBe(false);
    expect(isPayrollModuleRouteEnabled([])).toBe(false);
  });
});
