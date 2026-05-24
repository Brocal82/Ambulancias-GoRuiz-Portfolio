import { describe, it, expect } from "vitest";
import { MODULE_KEYS } from "../../../constants/modules";

/** Mirrors RequireModule(name="documents") — documents routes need this module. */
export function isDocumentsModuleRouteEnabled(
  enabledModules: string[],
): boolean {
  return enabledModules.includes(MODULE_KEYS.DOCUMENTS);
}

describe("documents module gate", () => {
  it("habilita rutas solo con módulo documents", () => {
    expect(isDocumentsModuleRouteEnabled([MODULE_KEYS.DOCUMENTS])).toBe(true);
    expect(isDocumentsModuleRouteEnabled([MODULE_KEYS.PAYROLL])).toBe(false);
    expect(isDocumentsModuleRouteEnabled([])).toBe(false);
  });
});
