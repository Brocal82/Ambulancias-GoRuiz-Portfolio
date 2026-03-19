import { describe, it, expect } from "vitest";
import { getApiErrorMessage } from "./toast";

describe("getApiErrorMessage", () => {
  it("returns string when err is a string", () => {
    expect(getApiErrorMessage("Error directo")).toBe("Error directo");
  });

  it("returns axios response.data.message when present", () => {
    const err = {
      response: { data: { message: "Mensaje del servidor" } },
    };
    expect(getApiErrorMessage(err)).toBe("Mensaje del servidor");
  });

  it("returns err.message when no axios structure", () => {
    const err = new Error("Error estándar");
    expect(getApiErrorMessage(err)).toBe("Error estándar");
  });

  it("returns err.error when error is string", () => {
    const err = { error: "Error en campo" };
    expect(getApiErrorMessage(err)).toBe("Error en campo");
  });

  it("returns fallback when err is null/undefined", () => {
    expect(getApiErrorMessage(null, "Fallback")).toBe("Fallback");
    expect(getApiErrorMessage(undefined, "Fallback")).toBe("Fallback");
  });

  it("returns fallback when err has no message/error", () => {
    const err = { foo: "bar" };
    expect(getApiErrorMessage(err, "Default")).toBe("Default");
  });

  it("returns default fallback when not provided", () => {
    expect(getApiErrorMessage(null)).toBe("Ha ocurrido un error");
  });

  it("prefers axios message over err.message", () => {
    const err = {
      message: "Local",
      response: { data: { message: "API" } },
    };
    expect(getApiErrorMessage(err)).toBe("API");
  });
});
