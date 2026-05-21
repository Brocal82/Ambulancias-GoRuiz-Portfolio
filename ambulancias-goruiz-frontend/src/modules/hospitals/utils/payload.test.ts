import { describe, it, expect } from "vitest";
import {
  buildCreateHospitalPayload,
  buildUpdateHospitalPayload,
} from "./payload";
import type { Hospital } from "../domain/types";

describe("buildCreateHospitalPayload", () => {
  it("recorta strings y normaliza specialties", () => {
    const payload = buildCreateHospitalPayload({
      name: "  Hospital A  ",
      address: "  Calle 1  ",
      phone: "  +34 123  ",
      specialties: [" Urgencias ", "", "Trauma"],
    });

    expect(payload).toEqual({
      name: "Hospital A",
      address: "Calle 1",
      phone: "+34 123",
      specialties: ["Urgencias", "Trauma"],
      isOpen: true,
    });
  });

  it("devuelve specialties vacío si no hay valores válidos", () => {
    const payload = buildCreateHospitalPayload({
      name: "Hospital",
      address: "Calle",
      phone: "123",
      specialties: ["", "  "],
    });

    expect(payload.specialties).toEqual([]);
  });
});

describe("buildUpdateHospitalPayload", () => {
  const base: Hospital = {
    _id: "h1",
    name: "Original",
    address: "Dir Original",
    phone: "+34 111",
    specialties: ["Urgencias"],
    isOpen: true,
  };

  it("incluye isOpen cuando el hospital base usa isOpen", () => {
    const updated = { ...base, name: " Nuevo ", isOpen: false };
    const payload = buildUpdateHospitalPayload(base, updated);

    expect(payload.name).toBe("Nuevo");
    expect(payload.isOpen).toBe(false);
    expect(payload.specialties).toEqual(["Urgencias"]);
  });

  it("usa status cuando el hospital base no tiene isOpen boolean", () => {
    const legacyBase = {
      ...base,
      isOpen: undefined,
      status: "open",
    } as unknown as Hospital;
    const updated = { ...legacyBase, isOpen: false } as Hospital;
    const payload = buildUpdateHospitalPayload(legacyBase, updated);

    expect((payload as { status?: string }).status).toBe("closed");
    expect(payload.isOpen).toBeUndefined();
  });
});
