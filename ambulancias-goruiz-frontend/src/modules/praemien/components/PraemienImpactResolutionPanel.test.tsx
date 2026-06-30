/**
 * Phase 3.4.3 — PraemienImpactResolutionPanel + Modal tests.
 *
 * Covers:
 *   Panel: hidden when no items, visible when items exist, correct rendering
 *   Modal: open on review, info display, no raw IDs, required note, status select
 *   Flows: ignored, adjusted, blocked
 *   Post-save: toast, item removed from list
 *   Realtime: PRAEMIEN_MANUAL_PENDING_CHANGED refreshes list
 *   "View corrected Workday" navigation
 *   Regression: AdminPraemienPage renders rules panel + panel + queue
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup, act } from "@testing-library/react";

// ── Module mocks (top-level) ──────────────────────────────────────────────────

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  MemoryRouter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../domain/impactResolutionApi", () => ({
  listImpactResolutions: vi.fn(),
  resolveImpactResolution: vi.fn(),
}));

vi.mock("../../../utils/toast", () => ({
  toastT: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import React from "react";
import {
  listImpactResolutions,
  resolveImpactResolution,
  type PraemienImpactResolutionDTO,
} from "../domain/impactResolutionApi";
import { toastT } from "../../../utils/toast";
import { PRAEMIEN_MANUAL_PENDING_CHANGED } from "../utils/praemienManualPendingEvents";
import { PraemienImpactResolutionPanel } from "./PraemienImpactResolutionPanel";
import { PraemienImpactResolutionModal } from "./PraemienImpactResolutionModal";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

const makeResolution = (
  overrides?: Partial<PraemienImpactResolutionDTO>,
): PraemienImpactResolutionDTO => ({
  id: "res-001",
  status: "pending",
  workerId: "worker-oid-001",
  workerName: "Max Mustermann",
  year: 2026,
  month: 7,
  beforeValue: 5,
  afterValue: 6,
  delta: 1,
  reason: "Miscounted patients",
  relatedWorkdaySummaryId: "summary-oid-001",
  relatedWorkdaySummaryCorrectionId: "correction-oid-001",
  createdAt: "2026-07-15T10:00:00Z",
  updatedAt: "2026-07-15T10:00:00Z",
  ...overrides,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPanel() {
  return render(
    <React.Suspense fallback={null}>
      <PraemienImpactResolutionPanel />
    </React.Suspense>,
  );
}

// ── Panel tests ───────────────────────────────────────────────────────────────

describe("PraemienImpactResolutionPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("is hidden when no pending items exist", async () => {
    vi.mocked(listImpactResolutions).mockResolvedValue([]);

    const { container } = renderPanel();

    await waitFor(() => {
      expect(container.querySelector("[data-testid='impact-resolution-panel']")).toBeNull();
    });
  });

  it("shows the panel when pending items exist", async () => {
    vi.mocked(listImpactResolutions).mockResolvedValue([makeResolution()]);

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("impact-resolution-panel")).toBeTruthy();
    });
  });

  it("renders correct table columns", async () => {
    vi.mocked(listImpactResolutions).mockResolvedValue([makeResolution()]);

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("impact-resolution-table")).toBeTruthy();
    });
  });

  it("renders worker name in row", async () => {
    vi.mocked(listImpactResolutions).mockResolvedValue([makeResolution()]);

    renderPanel();

    await waitFor(() => {
      const names = screen.getAllByTestId("row-worker-name");
      expect(names[0].textContent).toBe("Max Mustermann");
    });
  });

  it("renders before and after values in row", async () => {
    vi.mocked(listImpactResolutions).mockResolvedValue([makeResolution()]);

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("row-before-value").textContent).toBe("5");
      expect(screen.getByTestId("row-after-value").textContent).toBe("6");
      expect(screen.getByTestId("row-delta").textContent).toBe("+1");
    });
  });

  it("does NOT render raw ObjectIds in any row cell", async () => {
    const res = makeResolution();
    vi.mocked(listImpactResolutions).mockResolvedValue([res]);

    renderPanel();

    await waitFor(() => {
      const panelText = screen.getByTestId("impact-resolution-panel").textContent ?? "";
      expect(panelText).not.toContain(res.workerId);
      expect(panelText).not.toContain(res.relatedWorkdaySummaryId);
      expect(panelText).not.toContain(res.relatedWorkdaySummaryCorrectionId);
      expect(panelText).not.toContain(res.id);
    });
  });

  it("shows Review button per row", async () => {
    vi.mocked(listImpactResolutions).mockResolvedValue([makeResolution()]);

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("review-button")).toBeTruthy();
    });
  });

  it("shows View corrected Workday button per row", async () => {
    vi.mocked(listImpactResolutions).mockResolvedValue([makeResolution()]);

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("view-workday-button")).toBeTruthy();
    });
  });

  it("View corrected Workday navigates to /admin/summaries", async () => {
    vi.mocked(listImpactResolutions).mockResolvedValue([makeResolution()]);

    renderPanel();

    await waitFor(() => {
      screen.getByTestId("view-workday-button");
    });

    fireEvent.click(screen.getByTestId("view-workday-button"));

    expect(mockNavigate).toHaveBeenCalledWith("/admin/summaries");
  });

  it("opens modal when Review button is clicked", async () => {
    vi.mocked(listImpactResolutions).mockResolvedValue([makeResolution()]);

    renderPanel();

    await waitFor(() => {
      screen.getByTestId("review-button");
    });

    fireEvent.click(screen.getByTestId("review-button"));

    expect(screen.getByTestId("impact-resolution-modal")).toBeTruthy();
  });

  it("shows loading state on first load", async () => {
    let resolve!: (v: PraemienImpactResolutionDTO[]) => void;
    vi.mocked(listImpactResolutions).mockReturnValue(
      new Promise<PraemienImpactResolutionDTO[]>((r) => {
        resolve = r;
      }),
    );

    renderPanel();

    expect(screen.getByTestId("impact-resolution-loading")).toBeTruthy();

    await act(async () => {
      resolve([]);
    });
  });

  it("refreshes list on PRAEMIEN_MANUAL_PENDING_CHANGED event", async () => {
    vi.mocked(listImpactResolutions)
      .mockResolvedValueOnce([makeResolution()])
      .mockResolvedValueOnce([makeResolution(), makeResolution({ id: "res-002" })]);

    renderPanel();

    await waitFor(() => {
      expect(screen.getAllByTestId("impact-resolution-row")).toHaveLength(1);
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent(PRAEMIEN_MANUAL_PENDING_CHANGED));
    });

    await waitFor(() => {
      expect(screen.getAllByTestId("impact-resolution-row")).toHaveLength(2);
    });
  });

  it("removes resolved item from list after save", async () => {
    vi.mocked(listImpactResolutions).mockResolvedValue([makeResolution()]);
    vi.mocked(resolveImpactResolution).mockResolvedValue(
      makeResolution({ status: "ignored", note: "ok" }),
    );

    renderPanel();

    await waitFor(() => {
      screen.getByTestId("review-button");
    });

    fireEvent.click(screen.getByTestId("review-button"));

    fireEvent.change(screen.getByTestId("resolution-note-input"), {
      target: { value: "test note" },
    });
    fireEvent.click(screen.getByTestId("modal-save-button"));

    await waitFor(() => {
      expect(screen.queryByTestId("impact-resolution-row")).toBeNull();
    });
  });
});

// ── Modal tests ───────────────────────────────────────────────────────────────

describe("PraemienImpactResolutionModal", () => {
  const defaultOnClose = vi.fn();
  const defaultOnSaved = vi.fn();

  function renderModal(overrides?: Partial<PraemienImpactResolutionDTO>) {
    return render(
      <PraemienImpactResolutionModal
        resolution={makeResolution(overrides)}
        isOpen={true}
        onClose={defaultOnClose}
        onSaved={defaultOnSaved}
      />,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders modal when isOpen=true", () => {
    renderModal();
    expect(screen.getByTestId("impact-resolution-modal")).toBeTruthy();
  });

  it("does not render when isOpen=false", () => {
    render(
      <PraemienImpactResolutionModal
        resolution={makeResolution()}
        isOpen={false}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("impact-resolution-modal")).toBeNull();
  });

  it("displays worker name (not raw workerId)", () => {
    renderModal({ workerName: "Maria Müller", workerId: "raw-oid-xyz" });
    expect(screen.getByTestId("modal-worker-name").textContent).toBe("Maria Müller");
    const modalText = screen.getByTestId("impact-resolution-modal").textContent ?? "";
    expect(modalText).not.toContain("raw-oid-xyz");
  });

  it("displays original value, corrected value, delta", () => {
    renderModal({ beforeValue: 4, afterValue: 7, delta: 3 });
    expect(screen.getByTestId("modal-original").textContent).toBe("4");
    expect(screen.getByTestId("modal-corrected").textContent).toBe("7");
    expect(screen.getByTestId("modal-delta").textContent).toBe("+3");
  });

  it("displays reason", () => {
    renderModal({ reason: "Urgent correction" });
    expect(screen.getByTestId("modal-reason").textContent).toBe("Urgent correction");
  });

  it("displays current status label", () => {
    renderModal({ status: "pending" });
    expect(screen.getByTestId("modal-current-status").textContent).toContain(
      "pages.praemien.impactResolution.status.pending",
    );
  });

  it("shows existing note when present", () => {
    renderModal({ note: "Previous admin note" });
    expect(screen.getByTestId("modal-existing-note").textContent).toBe(
      "Previous admin note",
    );
  });

  it("does NOT show existing note row when note is absent", () => {
    renderModal({ note: undefined });
    expect(screen.queryByTestId("modal-existing-note")).toBeNull();
  });

  it("does NOT expose raw ObjectIds in modal content", () => {
    const res = makeResolution();
    renderModal();
    const modalText = screen.getByTestId("impact-resolution-modal").textContent ?? "";
    expect(modalText).not.toContain(res.id);
    expect(modalText).not.toContain(res.workerId);
    expect(modalText).not.toContain(res.relatedWorkdaySummaryId);
    expect(modalText).not.toContain(res.relatedWorkdaySummaryCorrectionId);
  });

  it("shows note-required error when save clicked with empty note", () => {
    renderModal();
    fireEvent.click(screen.getByTestId("modal-save-button"));
    expect(screen.getByTestId("note-error")).toBeTruthy();
    expect(resolveImpactResolution).not.toHaveBeenCalled();
  });

  it("shows note-required error when note is only whitespace", () => {
    renderModal();
    fireEvent.change(screen.getByTestId("resolution-note-input"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByTestId("modal-save-button"));
    expect(screen.getByTestId("note-error")).toBeTruthy();
  });

  it("clears note error when user starts typing", () => {
    renderModal();
    fireEvent.click(screen.getByTestId("modal-save-button"));
    expect(screen.getByTestId("note-error")).toBeTruthy();

    fireEvent.change(screen.getByTestId("resolution-note-input"), {
      target: { value: "real note" },
    });
    expect(screen.queryByTestId("note-error")).toBeNull();
  });

  it("calls resolveImpactResolution with ignored and note", async () => {
    vi.mocked(resolveImpactResolution).mockResolvedValue(
      makeResolution({ status: "ignored", note: "dismissed" }),
    );
    renderModal();

    fireEvent.change(screen.getByTestId("resolution-note-input"), {
      target: { value: "dismissed" },
    });
    fireEvent.click(screen.getByTestId("modal-save-button"));

    await waitFor(() => {
      expect(resolveImpactResolution).toHaveBeenCalledWith("res-001", {
        newStatus: "ignored",
        note: "dismissed",
      });
    });
  });

  it("calls resolveImpactResolution with adjusted status", async () => {
    vi.mocked(resolveImpactResolution).mockResolvedValue(
      makeResolution({ status: "adjusted" }),
    );
    renderModal();

    fireEvent.change(screen.getByTestId("resolution-status-select"), {
      target: { value: "adjusted" },
    });
    fireEvent.change(screen.getByTestId("resolution-note-input"), {
      target: { value: "manual adjustment" },
    });
    fireEvent.click(screen.getByTestId("modal-save-button"));

    await waitFor(() => {
      expect(resolveImpactResolution).toHaveBeenCalledWith("res-001", {
        newStatus: "adjusted",
        note: "manual adjustment",
      });
    });
  });

  it("calls resolveImpactResolution with blocked status", async () => {
    vi.mocked(resolveImpactResolution).mockResolvedValue(
      makeResolution({ status: "blocked" }),
    );
    renderModal();

    fireEvent.change(screen.getByTestId("resolution-status-select"), {
      target: { value: "blocked" },
    });
    fireEvent.change(screen.getByTestId("resolution-note-input"), {
      target: { value: "period closed" },
    });
    fireEvent.click(screen.getByTestId("modal-save-button"));

    await waitFor(() => {
      expect(resolveImpactResolution).toHaveBeenCalledWith("res-001", {
        newStatus: "blocked",
        note: "period closed",
      });
    });
  });

  it("status select does NOT include recalculated option", () => {
    renderModal();
    const select = screen.getByTestId("resolution-status-select") as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).not.toContain("recalculated");
    expect(options).toContain("ignored");
    expect(options).toContain("adjusted");
    expect(options).toContain("blocked");
  });

  it("shows success toast after save", async () => {
    vi.mocked(resolveImpactResolution).mockResolvedValue(
      makeResolution({ status: "ignored" }),
    );
    renderModal();

    fireEvent.change(screen.getByTestId("resolution-note-input"), {
      target: { value: "test" },
    });
    fireEvent.click(screen.getByTestId("modal-save-button"));

    await waitFor(() => {
      expect(toastT.success).toHaveBeenCalledWith(
        "pages.praemien.impactResolution.toast.ignored",
      );
    });
  });

  it("calls onSaved after successful save", async () => {
    const updated = makeResolution({ status: "ignored" });
    vi.mocked(resolveImpactResolution).mockResolvedValue(updated);
    renderModal();

    fireEvent.change(screen.getByTestId("resolution-note-input"), {
      target: { value: "test note" },
    });
    fireEvent.click(screen.getByTestId("modal-save-button"));

    await waitFor(() => {
      expect(defaultOnSaved).toHaveBeenCalledWith(updated);
    });
  });

  it("shows error toast when save fails with generic error", async () => {
    vi.mocked(resolveImpactResolution).mockRejectedValue(new Error("network"));
    renderModal();

    fireEvent.change(screen.getByTestId("resolution-note-input"), {
      target: { value: "test" },
    });
    fireEvent.click(screen.getByTestId("modal-save-button"));

    await waitFor(() => {
      expect(toastT.error).toHaveBeenCalledWith(
        "pages.praemien.impactResolution.modal.saveError",
      );
    });
  });

  it("shows already-resolved toast and closes when 409 received", async () => {
    vi.mocked(resolveImpactResolution).mockRejectedValue({
      response: { status: 409 },
    });
    renderModal();

    fireEvent.change(screen.getByTestId("resolution-note-input"), {
      target: { value: "test" },
    });
    fireEvent.click(screen.getByTestId("modal-save-button"));

    await waitFor(() => {
      expect(toastT.error).toHaveBeenCalledWith(
        "pages.praemien.impactResolution.modal.alreadyResolved",
      );
      expect(defaultOnClose).toHaveBeenCalled();
    });
  });

  it("calls onClose when Cancel is clicked", () => {
    renderModal();
    fireEvent.click(screen.getByTestId("modal-cancel-button"));
    expect(defaultOnClose).toHaveBeenCalled();
  });
});

// ── Regression: AdminPraemienPage ─────────────────────────────────────────────

vi.mock("./AdminPraemienRulesPanel", () => ({
  AdminPraemienRulesPanel: () => <div data-testid="rules-panel-mock" />,
}));

vi.mock("./AdminManualPraemieQueuePanel", () => ({
  AdminManualPraemieQueuePanel: () => <div data-testid="queue-panel-mock" />,
}));

describe("AdminPraemienPage regression", () => {
  afterEach(() => cleanup());

  it("renders rules panel, impact panel, and queue panel", async () => {
    vi.mocked(listImpactResolutions).mockResolvedValue([makeResolution()]);

    const { default: AdminPraemienPage } = await import(
      "../pages/AdminPraemienPage"
    );

    render(<AdminPraemienPage />);

    expect(screen.getByTestId("rules-panel-mock")).toBeTruthy();
    expect(screen.getByTestId("queue-panel-mock")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId("impact-resolution-panel")).toBeTruthy();
    });
  });

  it("hides impact panel from AdminPraemienPage when no pending items", async () => {
    vi.mocked(listImpactResolutions).mockResolvedValue([]);

    const { default: AdminPraemienPage } = await import(
      "../pages/AdminPraemienPage"
    );

    const { container } = render(<AdminPraemienPage />);

    await waitFor(() => {
      expect(container.querySelector("[data-testid='impact-resolution-panel']")).toBeNull();
    });
  });
});
