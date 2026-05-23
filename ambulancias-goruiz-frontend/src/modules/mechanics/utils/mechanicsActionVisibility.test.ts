import { describe, it, expect } from "vitest";
import {
  canDeleteMechanicsIssues,
  canMechanicCompleteWorkOrder,
  canMechanicStartWorkOrder,
  canPlanCancelWorkOrder,
  canPlanMechanicsWorkOrders,
  isMechanicsOperatorRole,
} from "./mechanicsActionVisibility";

describe("mechanicsActionVisibility", () => {
  describe("canPlanMechanicsWorkOrders", () => {
    it("true para admin y jefe_mecanicos", () => {
      expect(canPlanMechanicsWorkOrders("admin")).toBe(true);
      expect(canPlanMechanicsWorkOrders("jefe_mecanicos")).toBe(true);
    });

    it("false para mecanico y worker", () => {
      expect(canPlanMechanicsWorkOrders("mecanico")).toBe(false);
      expect(canPlanMechanicsWorkOrders("worker")).toBe(false);
    });
  });

  describe("work order actions by role", () => {
    it("mecanico puede iniciar solo en pending", () => {
      expect(canMechanicStartWorkOrder("mecanico", "pending")).toBe(true);
      expect(canMechanicStartWorkOrder("mecanico", "in_progress")).toBe(false);
      expect(canMechanicStartWorkOrder("admin", "pending")).toBe(false);
    });

    it("mecanico puede completar solo en in_progress", () => {
      expect(canMechanicCompleteWorkOrder("mecanico", "in_progress")).toBe(true);
      expect(canMechanicCompleteWorkOrder("mecanico", "pending")).toBe(false);
    });

    it("admin/jefe pueden cancelar pending o in_progress", () => {
      expect(canPlanCancelWorkOrder("admin", "pending")).toBe(true);
      expect(canPlanCancelWorkOrder("jefe_mecanicos", "in_progress")).toBe(true);
      expect(canPlanCancelWorkOrder("admin", "completed")).toBe(false);
      expect(canPlanCancelWorkOrder("mecanico", "pending")).toBe(false);
    });
  });

  describe("issue mutations", () => {
    it("solo admin/jefe pueden borrar averías", () => {
      expect(canDeleteMechanicsIssues("admin")).toBe(true);
      expect(canDeleteMechanicsIssues("jefe_mecanicos")).toBe(true);
      expect(canDeleteMechanicsIssues("mecanico")).toBe(false);
    });
  });

  describe("isMechanicsOperatorRole", () => {
    it("true solo para mecanico", () => {
      expect(isMechanicsOperatorRole("mecanico")).toBe(true);
      expect(isMechanicsOperatorRole("jefe_mecanicos")).toBe(false);
    });
  });
});
