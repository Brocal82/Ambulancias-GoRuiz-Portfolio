import { describe, it, expect } from "vitest";
import { MODULE_KEYS } from "../../../constants/modules";

export function isVacationModuleRouteEnabled(enabledModules: string[]): boolean {
  return enabledModules.includes(MODULE_KEYS.VACATION);
}

export function isSickLeavesModuleRouteEnabled(enabledModules: string[]): boolean {
  return enabledModules.includes(MODULE_KEYS.SICK_LEAVES);
}

describe("vacation module gate", () => {
  it("habilita rutas solo con módulo vacation", () => {
    expect(isVacationModuleRouteEnabled([MODULE_KEYS.VACATION])).toBe(true);
    expect(isVacationModuleRouteEnabled([MODULE_KEYS.SICK_LEAVES])).toBe(false);
    expect(isVacationModuleRouteEnabled([])).toBe(false);
  });
});

describe("sick leaves module gate", () => {
  it("habilita rutas solo con módulo sick_leaves", () => {
    expect(isSickLeavesModuleRouteEnabled([MODULE_KEYS.SICK_LEAVES])).toBe(true);
    expect(isSickLeavesModuleRouteEnabled([MODULE_KEYS.VACATION])).toBe(false);
    expect(isSickLeavesModuleRouteEnabled([])).toBe(false);
  });
});
