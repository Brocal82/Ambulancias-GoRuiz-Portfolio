import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  OperationalHealthBadge,
  type HealthStatus,
} from "./OperationalHealthBadge";

const noop = vi.fn();

function renderBadge(status: HealthStatus, count = 0, lastScannedAt: Date | null = null, isScanning = false) {
  return render(
    <OperationalHealthBadge
      status={status}
      inconsistencyCount={count}
      lastScannedAt={lastScannedAt}
      isScanning={isScanning}
      onScan={noop}
    />,
  );
}

describe("OperationalHealthBadge", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders healthy state with green indicator", () => {
    renderBadge("healthy", 0);
    const status = screen.getByTestId("health-status-text");
    expect(status.textContent).toContain("🟢");
    expect(status.textContent).toContain("Sin incidencias");
  });

  it("renders warning state with count", () => {
    renderBadge("warning", 3);
    const status = screen.getByTestId("health-status-text");
    expect(status.textContent).toContain("⚠️");
    expect(status.textContent).toContain("3 inconsistencias");
  });

  it("renders single inconsistency label", () => {
    renderBadge("warning", 1);
    const status = screen.getByTestId("health-status-text");
    expect(status.textContent).toContain("1 inconsistencia");
  });

  it("renders outdated state", () => {
    renderBadge("outdated", 0);
    const status = screen.getByTestId("health-status-text");
    expect(status.textContent).toContain("⚪");
    expect(status.textContent).toContain("desactualizado");
  });

  it("renders never-scanned state", () => {
    renderBadge("never", 0);
    const status = screen.getByTestId("health-status-text");
    expect(status.textContent).toContain("⚪");
    expect(status.textContent).toContain("Sin escanear");
  });

  it("shows last scan time when provided", () => {
    const d = new Date("2026-06-28T10:30:00");
    renderBadge("healthy", 0, d);
    const lastScanned = screen.getByTestId("health-last-scanned");
    expect(lastScanned).toBeTruthy();
  });

  it("does not show last scan time when null", () => {
    renderBadge("healthy", 0, null);
    expect(screen.queryByTestId("health-last-scanned")).toBeNull();
  });

  it("calls onScan when scan button clicked", () => {
    const onScan = vi.fn();
    render(
      <OperationalHealthBadge
        status="healthy"
        inconsistencyCount={0}
        lastScannedAt={null}
        isScanning={false}
        onScan={onScan}
      />,
    );
    fireEvent.click(screen.getByTestId("health-scan-button"));
    expect(onScan).toHaveBeenCalledOnce();
  });

  it("disables scan button while scanning", () => {
    renderBadge("healthy", 0, null, true);
    const btn = screen.getByTestId("health-scan-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain("Escaneando");
  });
});
