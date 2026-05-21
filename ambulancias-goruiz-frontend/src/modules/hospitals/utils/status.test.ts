import { describe, it, expect } from "vitest";
import type { Hospital } from "../domain/types";
import {
  fromLocalHospitalStatus,
  getHospitalIsOpen,
  toLocalHospitalStatus,
} from "./status";

describe("getHospitalIsOpen", () => {
  it("lee isOpen boolean", () => {
    expect(getHospitalIsOpen({ _id: "1", isOpen: true } as Hospital)).toBe(true);
    expect(getHospitalIsOpen({ _id: "1", isOpen: false } as Hospital)).toBe(false);
  });

  it("convierte status legacy open/closed", () => {
    expect(
      getHospitalIsOpen({ _id: "1", status: "open" } as unknown as Hospital),
    ).toBe(true);
    expect(
      getHospitalIsOpen({ _id: "1", status: "closed" } as unknown as Hospital),
    ).toBe(false);
  });

  it("devuelve undefined si no hay dato", () => {
    expect(getHospitalIsOpen({ _id: "1" } as Hospital)).toBeUndefined();
  });
});

describe("fromLocalHospitalStatus", () => {
  it("emite isOpen para hospitales con isOpen boolean", () => {
    const base = { _id: "1", isOpen: true } as Hospital;
    expect(fromLocalHospitalStatus(base, false)).toEqual({ isOpen: false });
  });

  it("emite status para hospitales legacy", () => {
    const base = { _id: "1", status: "open" } as unknown as Hospital;
    expect(fromLocalHospitalStatus(base, true)).toEqual({ status: "open" });
    expect(fromLocalHospitalStatus(base, false)).toEqual({ status: "closed" });
  });

  it("toLocalHospitalStatus delega en getHospitalIsOpen", () => {
    const hospital = { _id: "1", isOpen: true } as Hospital;
    expect(toLocalHospitalStatus(hospital)).toBe(true);
  });
});
