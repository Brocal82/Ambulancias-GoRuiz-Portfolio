import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { PayrollReadinessPanel } from "./PayrollReadinessPanel";
import { getPayrollReadiness } from "../domain/api";
import type { PayrollReadinessResponse } from "../domain/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../domain/api", () => ({
  getPayrollReadiness: vi.fn(),
}));

const readySummary: PayrollReadinessResponse = {
  payrollWorkers: 23,
  missingEmployeeNumbers: 0,
  duplicateEmployeeNumbers: 0,
  readiness: "READY",
};

const warningSummary: PayrollReadinessResponse = {
  payrollWorkers: 23,
  missingEmployeeNumbers: 2,
  duplicateEmployeeNumbers: 1,
  readiness: "WARNING",
};

describe("PayrollReadinessPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders READY status and metrics", async () => {
    vi.mocked(getPayrollReadiness).mockResolvedValue(readySummary);

    render(<PayrollReadinessPanel />);

    await waitFor(() => {
      expect(screen.getByText("pages.payroll.readiness.status.READY")).toBeTruthy();
    });

    expect(screen.getByText("23")).toBeTruthy();
    expect(screen.getAllByText("0")).toHaveLength(2);
    expect(
      screen.queryByText("pages.payroll.readiness.status.WARNING"),
    ).toBeNull();
  });

  it("renders WARNING status and metrics", async () => {
    vi.mocked(getPayrollReadiness).mockResolvedValue(warningSummary);

    render(<PayrollReadinessPanel />);

    await waitFor(() => {
      expect(
        screen.getByText("pages.payroll.readiness.status.WARNING"),
      ).toBeTruthy();
    });

    expect(screen.getByText("23")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(
      screen.queryByText("pages.payroll.readiness.status.READY"),
    ).toBeNull();
  });

  it("displays metric labels", async () => {
    vi.mocked(getPayrollReadiness).mockResolvedValue(warningSummary);

    render(<PayrollReadinessPanel />);

    await waitFor(() => {
      expect(
        screen.getByText("pages.payroll.readiness.metrics.payrollWorkers"),
      ).toBeTruthy();
    });

    expect(
      screen.getByText("pages.payroll.readiness.metrics.missingEmployeeNumbers"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "pages.payroll.readiness.metrics.duplicateEmployeeNumbers",
      ),
    ).toBeTruthy();
  });
});
