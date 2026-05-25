import { describe, it, expect } from "vitest";
import { MODULE_KEYS } from "../../../constants/modules";

/** Mirrors RequireModule(name="workday") — workday routes need this module. */
export function isWorkdayModuleRouteEnabled(enabledModules: string[]): boolean {
  return enabledModules.includes(MODULE_KEYS.WORKDAY);
}

describe("workday module gate", () => {
  it("habilita rutas solo con módulo workday", () => {
    expect(isWorkdayModuleRouteEnabled([MODULE_KEYS.WORKDAY])).toBe(true);
    expect(isWorkdayModuleRouteEnabled([MODULE_KEYS.PAYROLL])).toBe(false);
    expect(isWorkdayModuleRouteEnabled([])).toBe(false);
  });
});
