import { describe, it, expect } from "vitest";

/** Maps backend closure errors to user-facing messages (same path as MyWorkdayPage toastT.apiError). */
export function mapClosureApiError(error: unknown, fallbackKey: string): string {
  if (error && typeof error === "object") {
    const ax = error as { response?: { data?: { message?: unknown } } };
    const msg = ax.response?.data?.message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return fallbackKey;
}

describe("closure error mapping", () => {
  it("maps 409 duplicate final closure message from API", () => {
    const err = {
      response: {
        status: 409,
        data: {
          message: "Ya existe un cierre final para este día y asignación.",
        },
      },
    };
    expect(mapClosureApiError(err, "toasts.workday.dayCloseError")).toContain(
      "cierre final",
    );
  });

  it("maps 409 stale snapshot message from API", () => {
    const err = {
      response: {
        status: 409,
        data: {
          message:
            "Los datos de viaje enviados no coinciden con el servidor; recarga la jornada.",
        },
      },
    };
    expect(mapClosureApiError(err, "toasts.workday.dayCloseError")).toContain(
      "recarga",
    );
  });

  it("falls back when API message is absent", () => {
    expect(mapClosureApiError({}, "toasts.workday.dayCloseError")).toBe(
      "toasts.workday.dayCloseError",
    );
  });

  it("maps 400 KM validation message from API", () => {
    const err = {
      response: {
        status: 400,
        data: { message: "El km final no puede ser menor que el inicial" },
      },
    };
    expect(mapClosureApiError(err, "toasts.workday.partialSendError")).toContain(
      "km final",
    );
  });
});
