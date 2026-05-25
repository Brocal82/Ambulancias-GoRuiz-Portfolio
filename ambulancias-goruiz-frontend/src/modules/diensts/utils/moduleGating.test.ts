import { describe, it, expect } from "vitest";
import { MODULE_KEYS } from "../../../constants/modules";

/**
 * Contrato de gating: los modales de ambulancia/team dependen de módulos habilitados.
 * (La UI oculta acciones cuando hasModule devuelve false.)
 */
describe("diensts module gating contract", () => {
  it("AMBULANCES y TEAMS son claves distintas de SCHEDULING", () => {
    expect(MODULE_KEYS.AMBULANCES).not.toBe(MODULE_KEYS.SCHEDULING);
    expect(MODULE_KEYS.TEAMS).not.toBe(MODULE_KEYS.SCHEDULING);
  });

  it("assign-ambulance requiere módulo AMBULANCES (backend route)", () => {
    expect(MODULE_KEYS.AMBULANCES).toBe("ambulances");
  });

  it("generate-week y assign-team requieren TEAMS además de SCHEDULING", () => {
    expect(MODULE_KEYS.TEAMS).toBe("teams");
    expect(MODULE_KEYS.SCHEDULING).toBe("scheduling");
  });
});
