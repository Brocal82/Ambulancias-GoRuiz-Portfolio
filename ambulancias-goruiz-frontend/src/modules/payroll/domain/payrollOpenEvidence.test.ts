/**
 * P1.4 — Payroll open evidence: admin visibility status helpers.
 *
 * Tests that the open evidence fields (firstOpenedAt, openCount)
 * are correctly interpreted to display "Abierto" / "No abierto" status.
 */
import { describe, it, expect } from "vitest";
import type { PayrollDocument } from "./types";

/** Returns the open status label that AdminPayrollPage renders for a doc. */
function openStatusLabel(doc: Pick<PayrollDocument, "firstOpenedAt" | "matchStatus" | "workerId">): string {
  if (doc.matchStatus === "unmatched" || !doc.workerId) return "—";
  return doc.firstOpenedAt ? "Abierto" : "No abierto";
}

function makeDoc(
  overrides: Partial<PayrollDocument> = {},
): Pick<PayrollDocument, "firstOpenedAt" | "matchStatus" | "workerId"> {
  return {
    matchStatus: "manual",
    workerId: { _id: "w1", name: "Juan", lastName: "García", email: "j@test.com" },
    firstOpenedAt: null,
    lastOpenedAt: null,
    openCount: 0,
    ...overrides,
  };
}

describe("P1.4 payroll open evidence: status labels", () => {
  it("muestra 'No abierto' cuando firstOpenedAt es null", () => {
    expect(openStatusLabel(makeDoc({ firstOpenedAt: null }))).toBe("No abierto");
  });

  it("muestra 'Abierto' cuando firstOpenedAt tiene timestamp", () => {
    expect(
      openStatusLabel(makeDoc({ firstOpenedAt: "2025-06-01T10:00:00.000Z" })),
    ).toBe("Abierto");
  });

  it("muestra '—' para documentos sin asignar (unmatched)", () => {
    expect(
      openStatusLabel(makeDoc({ matchStatus: "unmatched", workerId: null })),
    ).toBe("—");
  });

  it("muestra '—' cuando workerId es null aunque matchStatus sea matched", () => {
    expect(
      openStatusLabel(makeDoc({ matchStatus: "matched", workerId: null })),
    ).toBe("—");
  });

  it("documentos matched con firstOpenedAt muestran 'Abierto'", () => {
    expect(
      openStatusLabel(
        makeDoc({
          matchStatus: "matched",
          firstOpenedAt: "2025-06-15T09:30:00.000Z",
        }),
      ),
    ).toBe("Abierto");
  });
});
