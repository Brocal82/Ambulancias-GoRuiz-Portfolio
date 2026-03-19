import { describe, it, expect } from "vitest";
import { validateClosureData } from "./closureValidators";

const validBase = {
  vehicleConfirmed: true,
  ambulanceId: "amb-1",
  ambulanceNumber: "A-42",
  initialKm: 100,
  finalKm: 150,
};

describe("validateClosureData", () => {
  describe("cierre final válido", () => {
    it("retorna valid: true cuando todos los datos son correctos", () => {
      const result = validateClosureData({
        ...validBase,
        isPartial: false,
      });
      expect(result.valid).toBe(true);
    });

    it("acepta initialKm como string", () => {
      const result = validateClosureData({
        ...validBase,
        initialKm: "100",
        isPartial: false,
      });
      expect(result.valid).toBe(true);
    });
  });

  describe("cierre parcial válido", () => {
    it("retorna valid: true con razón no vacía", () => {
      const result = validateClosureData({
        ...validBase,
        isPartial: true,
        partialReason: "Fin de turno anticipado",
      });
      expect(result.valid).toBe(true);
    });
  });

  describe("razón vacía en parcial", () => {
    it("retorna error cuando partialReason es vacío", () => {
      const result = validateClosureData({
        ...validBase,
        isPartial: true,
        partialReason: "",
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.toastKey).toBe("toasts.workday.partialReasonRequired");
        expect(result.severity).toBe("warn");
      }
    });

    it("retorna error cuando partialReason es solo espacios", () => {
      const result = validateClosureData({
        ...validBase,
        isPartial: true,
        partialReason: "   ",
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.toastKey).toBe("toasts.workday.partialReasonRequired");
      }
    });

    it("retorna error cuando partialReason es undefined", () => {
      const result = validateClosureData({
        ...validBase,
        isPartial: true,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.toastKey).toBe("toasts.workday.partialReasonRequired");
      }
    });
  });

  describe("km final NaN", () => {
    it("retorna error con toastKey y severity warn", () => {
      const result = validateClosureData({
        ...validBase,
        finalKm: NaN,
        isPartial: false,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.toastKey).toBe("toasts.workday.enterFinalKmInModal");
        expect(result.severity).toBe("warn");
      }
    });

    it("retorna el mismo error para cierre parcial", () => {
      const result = validateClosureData({
        ...validBase,
        finalKm: NaN,
        isPartial: true,
        partialReason: "Motivo",
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.toastKey).toBe("toasts.workday.enterFinalKmInModal");
        expect(result.severity).toBe("warn");
      }
    });
  });

  describe("km final menor que km inicial", () => {
    it("retorna severity error en cierre final", () => {
      const result = validateClosureData({
        ...validBase,
        initialKm: 150,
        finalKm: 100,
        isPartial: false,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.toastKey).toBe("toasts.workday.finalKmLessThanInitial");
        expect(result.severity).toBe("error");
      }
    });

    it("retorna severity warn en cierre parcial", () => {
      const result = validateClosureData({
        ...validBase,
        initialKm: 150,
        finalKm: 100,
        isPartial: true,
        partialReason: "Motivo",
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.toastKey).toBe("toasts.workday.finalKmLessThanInitial");
        expect(result.severity).toBe("warn");
      }
    });
  });

  describe("falta de datos iniciales", () => {
    it("cierre final: retorna enterAmbulanceAndKm cuando falta vehicleConfirmed", () => {
      const result = validateClosureData({
        ...validBase,
        vehicleConfirmed: false,
        isPartial: false,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.toastKey).toBe("toasts.workday.enterAmbulanceAndKm");
        expect(result.severity).toBe("warn");
      }
    });

    it("cierre final: retorna enterAmbulanceAndKm cuando falta ambulanceId", () => {
      const result = validateClosureData({
        ...validBase,
        ambulanceId: "",
        isPartial: false,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.toastKey).toBe("toasts.workday.enterAmbulanceAndKm");
      }
    });

    it("cierre final: retorna enterAmbulanceAndKm cuando falta ambulanceNumber", () => {
      const result = validateClosureData({
        ...validBase,
        ambulanceNumber: "",
        isPartial: false,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.toastKey).toBe("toasts.workday.enterAmbulanceAndKm");
      }
    });

    it("cierre final: retorna enterAmbulanceAndKm cuando falta initialKm", () => {
      const result = validateClosureData({
        ...validBase,
        initialKm: "",
        isPartial: false,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.toastKey).toBe("toasts.workday.enterAmbulanceAndKm");
      }
    });

    it("cierre parcial: retorna needInitialData cuando falta vehicleConfirmed o ambulanceId", () => {
      const result = validateClosureData({
        ...validBase,
        vehicleConfirmed: false,
        isPartial: true,
        partialReason: "Motivo",
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.toastKey).toBe("toasts.workday.needInitialData");
        expect(result.severity).toBe("warn");
      }
    });

    it("cierre parcial: retorna enterAmbulanceAndKm cuando falta ambulanceNumber", () => {
      const result = validateClosureData({
        ...validBase,
        ambulanceNumber: "",
        isPartial: true,
        partialReason: "Motivo",
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.toastKey).toBe("toasts.workday.enterAmbulanceAndKm");
        expect(result.severity).toBe("warn");
      }
    });
  });
});
