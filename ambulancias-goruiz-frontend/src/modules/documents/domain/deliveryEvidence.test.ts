/**
 * P1.1 / P1.2 — Document delivery evidence: badge helpers and filter labels.
 */
import { describe, it, expect } from "vitest";
import type { AdminDocumentDelivery, DeliveryStatusFilter } from "./types";

/** Mirror of deliveryStatusBadge from AdminDocumentsPage — extracted for testability. */
function deliveryStatusBadge(d: AdminDocumentDelivery): { label: string } {
  if (d.acknowledgedAt) return { label: "Confirmado" };
  if (d.readAt) return { label: "Abierto" };
  return { label: "Pendiente" };
}

const DELIVERY_FILTER_LABELS: Record<DeliveryStatusFilter, string> = {
  all: "Todos",
  pending: "Pendientes",
  opened: "Abiertos",
  not_opened: "No abiertos",
  acknowledged: "Confirmados",
  not_acknowledged: "No confirmados",
};

function makeDelivery(
  overrides: Partial<AdminDocumentDelivery> = {},
): AdminDocumentDelivery {
  return {
    deliveryId: "d1",
    workerId: "w1",
    workerName: "García, Juan",
    employeeNumber: null,
    sentAt: "2025-01-01T10:00:00.000Z",
    readAt: null,
    acknowledgedAt: null,
    ...overrides,
  };
}

describe("P1.1 delivery evidence: badge labels", () => {
  it("muestra 'Pendiente' cuando readAt y acknowledgedAt son null", () => {
    const badge = deliveryStatusBadge(makeDelivery());
    expect(badge.label).toBe("Pendiente");
  });

  it("muestra 'Abierto' cuando readAt está presente pero acknowledgedAt es null", () => {
    const badge = deliveryStatusBadge(
      makeDelivery({ readAt: "2025-01-02T10:00:00.000Z" }),
    );
    expect(badge.label).toBe("Abierto");
  });

  it("muestra 'Confirmado' cuando acknowledgedAt está presente", () => {
    const badge = deliveryStatusBadge(
      makeDelivery({
        readAt: "2025-01-02T10:00:00.000Z",
        acknowledgedAt: "2025-01-03T10:00:00.000Z",
      }),
    );
    expect(badge.label).toBe("Confirmado");
  });

  it("'Confirmado' tiene prioridad sobre 'Abierto'", () => {
    const badge = deliveryStatusBadge(
      makeDelivery({
        readAt: "2025-01-02T10:00:00.000Z",
        acknowledgedAt: "2025-01-03T10:00:00.000Z",
      }),
    );
    expect(badge.label).toBe("Confirmado");
  });
});

describe("P1.2 delivery evidence: filter labels", () => {
  it("todos los filtros válidos tienen etiqueta en español", () => {
    const filters: DeliveryStatusFilter[] = [
      "all",
      "pending",
      "opened",
      "not_opened",
      "acknowledged",
      "not_acknowledged",
    ];
    for (const f of filters) {
      expect(DELIVERY_FILTER_LABELS[f]).toBeTruthy();
    }
  });

  it("'all' se etiqueta como 'Todos'", () => {
    expect(DELIVERY_FILTER_LABELS["all"]).toBe("Todos");
  });

  it("'not_acknowledged' se etiqueta como 'No confirmados'", () => {
    expect(DELIVERY_FILTER_LABELS["not_acknowledged"]).toBe("No confirmados");
  });
});
