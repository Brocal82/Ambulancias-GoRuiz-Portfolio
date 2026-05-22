import { describe, it, expect } from "vitest";
import {
  validateAmbulanceFormValues,
  hasMissingAmbulanceFields,
  normalizeAmbulanceFormValues,
} from "./ambulanceFormUtils";

const t = (key: string) => key;

describe("ambulanceFormUtils", () => {
  it("detecta campos obligatorios vacíos", () => {
    const errors = validateAmbulanceFormValues(
      { brand: "", modelName: "M", licensePlate: "P", ambulanceNumber: "1" },
      t,
    );
    expect(errors.brand).toBe("pages.ambulances.formModal.validation.required");
    expect(hasMissingAmbulanceFields({
      brand: "",
      modelName: "M",
      licensePlate: "P",
      ambulanceNumber: "1",
    })).toBe(true);
  });

  it("normaliza espacios en los valores", () => {
    const normalized = normalizeAmbulanceFormValues({
      brand: "  Ford  ",
      modelName: " Transit ",
      licensePlate: " 1234-ABC ",
      ambulanceNumber: " 7 ",
    });
    expect(normalized).toEqual({
      brand: "Ford",
      modelName: "Transit",
      licensePlate: "1234-ABC",
      ambulanceNumber: "7",
    });
  });
});
