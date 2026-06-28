import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AbsenceCleanupScanModal } from "./AbsenceCleanupScanModal";
import type { AbsenceInconsistency } from "../domain/absenceCleanupApi";

const baseInconsistency: AbsenceInconsistency = {
  workerId: "507f1f77bcf86cd799439011",
  workerName: "María García",
  absenceType: "vacation",
  absenceId: "507f1f77bcf86cd799439012",
  absenceStartDate: "2026-06-10",
  absenceEndDate: "2026-06-15",
  dienstId: "507f1f77bcf86cd799439013",
  dienstNumber: 3,
  assignmentRole: "driver",
  assignmentDate: "2026-06-12",
};

describe("AbsenceCleanupScanModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    render(
      <AbsenceCleanupScanModal
        isOpen={false}
        onClose={vi.fn()}
        inconsistencies={[]}
        isRepairing={false}
        onRepair={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("scan-modal")).toBeNull();
  });

  it("renders when isOpen is true", () => {
    render(
      <AbsenceCleanupScanModal
        isOpen={true}
        onClose={vi.fn()}
        inconsistencies={[]}
        isRepairing={false}
        onRepair={vi.fn()}
      />,
    );
    expect(screen.getByTestId("scan-modal")).toBeTruthy();
  });

  it("shows healthy message when inconsistencies is empty", () => {
    render(
      <AbsenceCleanupScanModal
        isOpen={true}
        onClose={vi.fn()}
        inconsistencies={[]}
        isRepairing={false}
        onRepair={vi.fn()}
      />,
    );
    expect(screen.getByTestId("scan-no-inconsistencies")).toBeTruthy();
  });

  it("renders a row per inconsistency", () => {
    const items = [
      baseInconsistency,
      { ...baseInconsistency, workerId: "aaa", workerName: "Pedro López", assignmentDate: "2026-06-13" },
    ];
    render(
      <AbsenceCleanupScanModal
        isOpen={true}
        onClose={vi.fn()}
        inconsistencies={items}
        isRepairing={false}
        onRepair={vi.fn()}
      />,
    );
    const rows = screen.getAllByTestId("scan-result-row");
    expect(rows).toHaveLength(2);
  });

  it("shows worker name in result rows", () => {
    render(
      <AbsenceCleanupScanModal
        isOpen={true}
        onClose={vi.fn()}
        inconsistencies={[baseInconsistency]}
        isRepairing={false}
        onRepair={vi.fn()}
      />,
    );
    expect(screen.getByText("María García")).toBeTruthy();
  });

  it("repair selected button is disabled when no rows selected", () => {
    render(
      <AbsenceCleanupScanModal
        isOpen={true}
        onClose={vi.fn()}
        inconsistencies={[baseInconsistency]}
        isRepairing={false}
        onRepair={vi.fn()}
      />,
    );
    const btn = screen.getByTestId("repair-selected-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("repair selected button enables after selecting a row", () => {
    render(
      <AbsenceCleanupScanModal
        isOpen={true}
        onClose={vi.fn()}
        inconsistencies={[baseInconsistency]}
        isRepairing={false}
        onRepair={vi.fn()}
      />,
    );
    const checkbox = screen.getAllByRole("checkbox")[1]; // first data checkbox
    fireEvent.click(checkbox);
    const btn = screen.getByTestId("repair-selected-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("opens confirmation dialog on repair click", () => {
    render(
      <AbsenceCleanupScanModal
        isOpen={true}
        onClose={vi.fn()}
        inconsistencies={[baseInconsistency]}
        isRepairing={false}
        onRepair={vi.fn()}
      />,
    );
    // Select row
    const checkbox = screen.getAllByRole("checkbox")[1];
    fireEvent.click(checkbox);
    // Click repair
    fireEvent.click(screen.getByTestId("repair-selected-button"));
    expect(screen.getByTestId("repair-confirm-dialog")).toBeTruthy();
  });

  it("calls onRepair with selected items on confirm", async () => {
    const onRepair = vi.fn().mockResolvedValue(undefined);
    render(
      <AbsenceCleanupScanModal
        isOpen={true}
        onClose={vi.fn()}
        inconsistencies={[baseInconsistency]}
        isRepairing={false}
        onRepair={onRepair}
      />,
    );
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.click(screen.getByTestId("repair-selected-button"));
    fireEvent.click(screen.getByTestId("repair-confirm-ok"));

    expect(onRepair).toHaveBeenCalledOnce();
    const [items] = onRepair.mock.calls[0] as [Array<{ workerId: string; absenceType: string; absenceId: string }>];
    expect(items).toHaveLength(1);
    expect(items[0].workerId).toBe(baseInconsistency.workerId);
    expect(items[0].absenceType).toBe("vacation");
    expect(items[0].absenceId).toBe(baseInconsistency.absenceId);
  });

  it("cancelling confirmation does not call onRepair", () => {
    const onRepair = vi.fn();
    render(
      <AbsenceCleanupScanModal
        isOpen={true}
        onClose={vi.fn()}
        inconsistencies={[baseInconsistency]}
        isRepairing={false}
        onRepair={onRepair}
      />,
    );
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.click(screen.getByTestId("repair-selected-button"));
    fireEvent.click(screen.getByTestId("repair-confirm-cancel"));
    expect(onRepair).not.toHaveBeenCalled();
  });

  it("shows repairing state when isRepairing is true", () => {
    render(
      <AbsenceCleanupScanModal
        isOpen={true}
        onClose={vi.fn()}
        inconsistencies={[baseInconsistency]}
        isRepairing={true}
        onRepair={vi.fn()}
      />,
    );
    const btn = screen.getByTestId("repair-selected-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain("Reparando");
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    render(
      <AbsenceCleanupScanModal
        isOpen={true}
        onClose={onClose}
        inconsistencies={[]}
        isRepairing={false}
        onRepair={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("scan-modal-close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("select-all selects all rows", () => {
    const items = [
      baseInconsistency,
      { ...baseInconsistency, workerId: "bbb", assignmentDate: "2026-06-13" },
    ];
    render(
      <AbsenceCleanupScanModal
        isOpen={true}
        onClose={vi.fn()}
        inconsistencies={items}
        isRepairing={false}
        onRepair={vi.fn()}
      />,
    );
    const selectAll = screen.getByTestId("select-all-checkbox");
    fireEvent.click(selectAll);
    const btn = screen.getByTestId("repair-selected-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(screen.getByText("2 seleccionado(s)")).toBeTruthy();
  });
});
