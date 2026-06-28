/**
 * Phase 3.3 — Workday Correction Dialog tests.
 * Covers: dialog rendering, button visibility by closure type,
 * effective fetch, corrected badge, validation, preview, save flow,
 * impact fields, toast/refresh behaviour, no raw ids shown.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";

// --- Module mocks (must be at top-level before imports) ---
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../domain/workdayRecoveryApi", () => ({
  getEffectiveWorkdaySummary: vi.fn(),
  createWorkdayCorrection: vi.fn(),
}));

vi.mock("../../../utils/toast", () => ({
  toastT: {
    success: vi.fn(),
    error: vi.fn(),
    apiError: vi.fn(),
  },
}));

vi.mock("../../../hooks/usePraemienWorkdayUiActive", () => ({
  usePraemienWorkdayUiActive: () => false,
}));

vi.mock("./ReviewSummary", () => ({
  default: () => <div data-testid="review-summary-mock" />,
}));

vi.mock("../utils/workdayEvents", () => ({
  emitWorkdaySummariesChanged: vi.fn(),
}));

// Must come after mocks
import {
  getEffectiveWorkdaySummary,
  createWorkdayCorrection,
} from "../domain/workdayRecoveryApi";
import { toastT } from "../../../utils/toast";
import { emitWorkdaySummariesChanged } from "../utils/workdayEvents";
import WorkdayCorrectionDialog from "./WorkdayCorrectionDialog";
import AdminWorkdaySummaryGroupContent from "./AdminWorkdaySummaryGroupContent";
import type { WorkdaySummary } from "../domain";
import type {
  EffectiveWorkdaySummaryResponse,
  WorkdayCorrectionCreatedResponse,
} from "../domain/workdayRecoveryApi";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SUMMARY_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

const makeEffectiveResponse = (
  overrides: Partial<EffectiveWorkdaySummaryResponse> = {},
): EffectiveWorkdaySummaryResponse => ({
  summaryId: SUMMARY_ID,
  assignmentId: "assign-1",
  date: "2026-06-10",
  workerIds: [],
  isFinalClosure: true,
  isReviewed: true,
  effective: {
    finalKm: 120,
    totalDienstKm: 50,
    totalEffectivePatients: 3,
    totalRealTrips: 4,
    hasCorrectedValues: false,
    activeCorrection: null,
    original: {
      finalKm: 120,
      totalDienstKm: 50,
      totalEffectivePatients: 3,
      totalRealTrips: 4,
    },
  },
  ...overrides,
});

const makeCorrectedResponse = (): EffectiveWorkdaySummaryResponse =>
  makeEffectiveResponse({
    effective: {
      finalKm: 130,
      totalDienstKm: 60,
      totalEffectivePatients: 4,
      totalRealTrips: 5,
      hasCorrectedValues: true,
      activeCorrection: {
        correctionReason: "Driver reported wrong KM",
        correctionNote: "See report #42",
        correctedAt: "2026-06-11T10:00:00.000Z",
        praemienImpact: "none",
        payrollImpact: "possible",
        correctedFinalKm: 130,
        correctedTotalDienstKm: 60,
        correctedTotalEffectivePatients: 4,
        correctedTotalRealTrips: 5,
      },
      original: {
        finalKm: 120,
        totalDienstKm: 50,
        totalEffectivePatients: 3,
        totalRealTrips: 4,
      },
    },
  });

const baseSummary: WorkdaySummary = {
  _id: SUMMARY_ID,
  date: "2026-06-10",
  assignmentId: "assign-1",
  driver: "driver-id",
  medic: "medic-id",
  ambulanceId: "amb-id",
  ambulanceNumber: "A-01",
  initialKm: 70,
  finalKm: 120,
  totalDienstKm: 50,
  totalEffectivePatients: 3,
  totalRealTrips: 4,
  isFinalClosure: true,
  trips: [],
};

const partialSummary: WorkdaySummary = {
  ...baseSummary,
  _id: "bbbbbbbbbbbbbbbbbbbbbbbb",
  isFinalClosure: false,
  finalKm: 0,
};

const createCorrectionResponse: WorkdayCorrectionCreatedResponse = {
  summaryId: SUMMARY_ID,
  correctionId: "corr-id-not-shown",
  correctedAt: "2026-06-11T10:00:00.000Z",
  correctedFinalKm: 130,
  praemienImpact: "none",
  payrollImpact: "none",
  correctionReason: "Driver reported wrong KM",
};

// ---------------------------------------------------------------------------
// WorkdayCorrectionDialog tests
// ---------------------------------------------------------------------------

describe("WorkdayCorrectionDialog", () => {
  beforeEach(() => {
    vi.mocked(getEffectiveWorkdaySummary).mockResolvedValue(
      makeEffectiveResponse(),
    );
    vi.mocked(createWorkdayCorrection).mockResolvedValue(
      createCorrectionResponse,
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    render(
      <WorkdayCorrectionDialog
        summaryId={SUMMARY_ID}
        isOpen={false}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("correction-dialog")).toBeNull();
  });

  it("renders dialog when isOpen is true", async () => {
    await act(async () => {
      render(
        <WorkdayCorrectionDialog
          summaryId={SUMMARY_ID}
          isOpen={true}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );
    });
    expect(screen.getByTestId("correction-dialog")).toBeTruthy();
    expect(screen.getByTestId("correction-dialog-title")).toBeTruthy();
  });

  it("fetches effective summary on open", async () => {
    await act(async () => {
      render(
        <WorkdayCorrectionDialog
          summaryId={SUMMARY_ID}
          isOpen={true}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );
    });
    expect(getEffectiveWorkdaySummary).toHaveBeenCalledWith(SUMMARY_ID);
  });

  it("renders preview with original values after fetch", async () => {
    await act(async () => {
      render(
        <WorkdayCorrectionDialog
          summaryId={SUMMARY_ID}
          isOpen={true}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );
    });
    expect(screen.getByTestId("correction-preview")).toBeTruthy();
    const origFinalKm = screen.getByTestId("preview-orig-finalKm");
    expect(origFinalKm.textContent).toBe("120");
    const origDienstKm = screen.getByTestId("preview-orig-dienstKm");
    expect(origDienstKm.textContent).toBe("50");
    const origPatients = screen.getByTestId("preview-orig-patients");
    expect(origPatients.textContent).toBe("3");
    const origTrips = screen.getByTestId("preview-orig-trips");
    expect(origTrips.textContent).toBe("4");
  });

  it("prefills numeric fields with current effective values", async () => {
    await act(async () => {
      render(
        <WorkdayCorrectionDialog
          summaryId={SUMMARY_ID}
          isOpen={true}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );
    });
    const finalKmInput = screen.getByTestId(
      "field-correctedFinalKm",
    ) as HTMLInputElement;
    expect(finalKmInput.value).toBe("120");
    const dienstKmInput = screen.getByTestId(
      "field-correctedTotalDienstKm",
    ) as HTMLInputElement;
    expect(dienstKmInput.value).toBe("50");
  });

  it("shows diff in preview after changing a field value", async () => {
    await act(async () => {
      render(
        <WorkdayCorrectionDialog
          summaryId={SUMMARY_ID}
          isOpen={true}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );
    });
    const finalKmInput = screen.getByTestId("field-correctedFinalKm");
    fireEvent.change(finalKmInput, { target: { value: "130" } });

    const correctedCell = screen.getByTestId("preview-corr-finalKm");
    expect(correctedCell.textContent).toBe("130");
    const diffCell = screen.getByTestId("preview-diff-finalKm");
    expect(diffCell.textContent).toBe("+10");
  });

  it("shows reason validation error when save clicked without reason", async () => {
    await act(async () => {
      render(
        <WorkdayCorrectionDialog
          summaryId={SUMMARY_ID}
          isOpen={true}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );
    });
    fireEvent.click(screen.getByTestId("correction-save"));
    expect(screen.getByTestId("reason-error")).toBeTruthy();
    expect(createWorkdayCorrection).not.toHaveBeenCalled();
  });

  it("shows at-least-one-field error when all numeric fields cleared", async () => {
    await act(async () => {
      render(
        <WorkdayCorrectionDialog
          summaryId={SUMMARY_ID}
          isOpen={true}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );
    });
    fireEvent.change(screen.getByTestId("field-correctedFinalKm"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByTestId("field-correctedTotalDienstKm"), {
      target: { value: "" },
    });
    fireEvent.change(
      screen.getByTestId("field-correctedTotalEffectivePatients"),
      { target: { value: "" } },
    );
    fireEvent.change(screen.getByTestId("field-correctedTotalRealTrips"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByTestId("field-correctionReason"), {
      target: { value: "A valid reason" },
    });
    fireEvent.click(screen.getByTestId("correction-save"));
    expect(screen.getByTestId("field-error-at-least-one")).toBeTruthy();
    expect(createWorkdayCorrection).not.toHaveBeenCalled();
  });

  it("calls createWorkdayCorrection with correct payload on valid submit", async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      render(
        <WorkdayCorrectionDialog
          summaryId={SUMMARY_ID}
          isOpen={true}
          onClose={onClose}
          onSaved={onSaved}
        />,
      );
    });

    fireEvent.change(screen.getByTestId("field-correctedFinalKm"), {
      target: { value: "130" },
    });
    fireEvent.change(screen.getByTestId("field-correctionReason"), {
      target: { value: "Driver reported wrong KM" },
    });
    fireEvent.change(screen.getByTestId("field-correctionNote"), {
      target: { value: "See report #42" },
    });
    fireEvent.change(screen.getByTestId("field-praemienImpact"), {
      target: { value: "none" },
    });
    fireEvent.change(screen.getByTestId("field-payrollImpact"), {
      target: { value: "possible" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("correction-save"));
    });

    expect(createWorkdayCorrection).toHaveBeenCalledOnce();
    const [calledId, calledInput] = vi.mocked(createWorkdayCorrection).mock
      .calls[0];
    expect(calledId).toBe(SUMMARY_ID);
    expect(calledInput.correctedFinalKm).toBe(130);
    expect(calledInput.correctionReason).toBe("Driver reported wrong KM");
    expect(calledInput.correctionNote).toBe("See report #42");
    expect(calledInput.praemienImpact).toBe("none");
    expect(calledInput.payrollImpact).toBe("possible");
  });

  it("calls onSaved and onClose after successful save", async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      render(
        <WorkdayCorrectionDialog
          summaryId={SUMMARY_ID}
          isOpen={true}
          onClose={onClose}
          onSaved={onSaved}
        />,
      );
    });

    fireEvent.change(screen.getByTestId("field-correctionReason"), {
      target: { value: "Valid reason" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("correction-save"));
    });

    expect(onSaved).toHaveBeenCalledWith(SUMMARY_ID);
    expect(onClose).toHaveBeenCalledOnce();
    expect(toastT.success).toHaveBeenCalledOnce();
  });

  it("shows error toast on save failure", async () => {
    vi.mocked(createWorkdayCorrection).mockRejectedValueOnce(
      new Error("server error"),
    );

    await act(async () => {
      render(
        <WorkdayCorrectionDialog
          summaryId={SUMMARY_ID}
          isOpen={true}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );
    });

    fireEvent.change(screen.getByTestId("field-correctionReason"), {
      target: { value: "Valid reason" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("correction-save"));
    });

    expect(toastT.apiError).toHaveBeenCalledOnce();
  });

  it("impact fields only offer none and possible options", async () => {
    await act(async () => {
      render(
        <WorkdayCorrectionDialog
          summaryId={SUMMARY_ID}
          isOpen={true}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );
    });

    const praemienSelect = screen.getByTestId(
      "field-praemienImpact",
    ) as HTMLSelectElement;
    const payrollSelect = screen.getByTestId(
      "field-payrollImpact",
    ) as HTMLSelectElement;

    const praemienOptions = Array.from(praemienSelect.options).map(
      (o) => o.value,
    );
    const payrollOptions = Array.from(payrollSelect.options).map((o) => o.value);

    expect(praemienOptions).toEqual(["none", "possible"]);
    expect(payrollOptions).toEqual(["none", "possible"]);
  });

  it("closes when close button clicked", async () => {
    const onClose = vi.fn();

    await act(async () => {
      render(
        <WorkdayCorrectionDialog
          summaryId={SUMMARY_ID}
          isOpen={true}
          onClose={onClose}
          onSaved={vi.fn()}
        />,
      );
    });

    fireEvent.click(screen.getByTestId("correction-dialog-close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not expose correctionId or raw ids in the UI", async () => {
    vi.mocked(getEffectiveWorkdaySummary).mockResolvedValue(
      makeCorrectedResponse(),
    );

    await act(async () => {
      render(
        <WorkdayCorrectionDialog
          summaryId={SUMMARY_ID}
          isOpen={true}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );
    });

    const dialogText =
      screen.getByTestId("correction-dialog").textContent ?? "";
    expect(dialogText).not.toContain("corr-id-not-shown");
    expect(dialogText).not.toContain("recoveryEventId");
  });
});

// ---------------------------------------------------------------------------
// AdminWorkdaySummaryGroupContent integration — button / badge visibility
// ---------------------------------------------------------------------------

describe("AdminWorkdaySummaryGroupContent — correction UI visibility", () => {
  beforeEach(() => {
    vi.mocked(getEffectiveWorkdaySummary).mockResolvedValue(
      makeEffectiveResponse(),
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows Correct Workday button only for final summaries", async () => {
    await act(async () => {
      render(<AdminWorkdaySummaryGroupContent summaries={[baseSummary]} />);
    });
    expect(screen.getByTestId("correct-workday-button")).toBeTruthy();
  });

  it("does not show correction button for partial summaries", async () => {
    await act(async () => {
      render(<AdminWorkdaySummaryGroupContent summaries={[partialSummary]} />);
    });
    expect(screen.queryByTestId("correct-workday-button")).toBeNull();
  });

  it("shows corrected badge when effective data has corrections", async () => {
    vi.mocked(getEffectiveWorkdaySummary).mockResolvedValue(
      makeCorrectedResponse(),
    );

    await act(async () => {
      render(<AdminWorkdaySummaryGroupContent summaries={[baseSummary]} />);
    });

    // Badge is rendered by StatusBadge — find the span containing the badge text
    const badges = screen.getAllByText(
      "pages.summaries.admin.detail.correction.badge",
    );
    expect(badges.length).toBeGreaterThan(0);
  });

  it("shows corrected section when active correction is present", async () => {
    vi.mocked(getEffectiveWorkdaySummary).mockResolvedValue(
      makeCorrectedResponse(),
    );

    await act(async () => {
      render(<AdminWorkdaySummaryGroupContent summaries={[baseSummary]} />);
    });

    expect(screen.getByTestId("corrected-section")).toBeTruthy();
    const sectionText =
      screen.getByTestId("corrected-section").textContent ?? "";
    expect(sectionText).toContain("Driver reported wrong KM");
    expect(sectionText).toContain("See report #42");
  });

  it("does not show correction section for partial summaries", async () => {
    await act(async () => {
      render(<AdminWorkdaySummaryGroupContent summaries={[partialSummary]} />);
    });
    expect(screen.queryByTestId("corrected-section")).toBeNull();
  });

  it("does not render correctionId or raw recovery IDs in the corrected section", async () => {
    vi.mocked(getEffectiveWorkdaySummary).mockResolvedValue(
      makeCorrectedResponse(),
    );

    await act(async () => {
      render(<AdminWorkdaySummaryGroupContent summaries={[baseSummary]} />);
    });

    const sectionText =
      screen.getByTestId("corrected-section").textContent ?? "";
    expect(sectionText).not.toContain("corr-id");
    expect(sectionText).not.toContain("recoveryEventId");
    expect(sectionText).not.toContain("summaryId");
  });

  it("opens correction dialog when Correct Workday button is clicked", async () => {
    await act(async () => {
      render(<AdminWorkdaySummaryGroupContent summaries={[baseSummary]} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("correct-workday-button"));
    });

    expect(screen.getByTestId("correction-dialog")).toBeTruthy();
  });

  it("calls emitWorkdaySummariesChanged after correction is saved", async () => {
    vi.mocked(createWorkdayCorrection).mockResolvedValue(
      createCorrectionResponse,
    );

    await act(async () => {
      render(<AdminWorkdaySummaryGroupContent summaries={[baseSummary]} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("correct-workday-button"));
    });

    fireEvent.change(screen.getByTestId("field-correctionReason"), {
      target: { value: "Valid reason" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("correction-save"));
    });

    expect(emitWorkdaySummariesChanged).toHaveBeenCalledOnce();
    // 1st: component mount, 2nd: dialog open (dialog fetches its own effective), 3rd: post-save refresh
    expect(getEffectiveWorkdaySummary).toHaveBeenCalledTimes(3);
  });
});
