/**
 * Phase 4.4 — Trip Recovery Dialog tests.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../domain/tripRecoveryApi", () => ({
  previewTripCorrection: vi.fn(),
  createTripCorrection: vi.fn(),
}));

vi.mock("../../../utils/toast", () => ({
  toastT: {
    success: vi.fn(),
    error: vi.fn(),
    apiError: vi.fn(),
  },
}));

import {
  previewTripCorrection,
  createTripCorrection,
  type TripCorrectionPreviewResponse,
} from "../domain/tripRecoveryApi";
import { toastT } from "../../../utils/toast";
import TripRecoveryDialog from "./TripRecoveryDialog";

const SUMMARY_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const TRIP_ID = "cccccccccccccccccccccccc";

const baseContext = {
  workdayDate: "2026-06-10",
  dienstNumber: 42,
  ambulanceNumber: "A-01",
  driverName: "Driver, Test",
  medicName: "Medic, Test",
  tripLabel: "08:30",
};

const initialValues = {
  countsTrip: 1 as const,
  wasCancelled: false,
  kmStart: 100,
  kmEnd: 120,
  timeWarning: "08:30",
  timeAtHome: "08:45",
  timePickup: "09:00",
  timeArrival: "09:30",
  timeEnd: "10:00",
};

const makePreviewResponse = (): TripCorrectionPreviewResponse => ({
  trip: {
    tripKey: TRIP_ID,
    type: "corrected",
    isIncludedInEffectiveCount: true,
    values: { ...initialValues, kmEnd: 125 },
    changedFields: ["kmEnd"],
  },
  workday: {
    projectionStatus: "applied",
    supersededPreviousWorkdayCorrection: false,
    before: {
      totalRealTrips: 4,
      totalEffectivePatients: 3,
      totalDienstKm: 50,
      finalKm: 120,
    },
    after: {
      totalRealTrips: 4,
      totalEffectivePatients: 3,
      totalDienstKm: 55,
      finalKm: 125,
    },
  },
  praemienImpact: "none",
  wouldSupersedePreviousCorrection: false,
});

describe("TripRecoveryDialog", () => {
  beforeEach(() => {
    vi.mocked(previewTripCorrection).mockResolvedValue(makePreviewResponse());
    vi.mocked(createTripCorrection).mockResolvedValue({
      correction: {
        id: "hidden-correction-id",
        type: "correct",
        status: "active",
        reason: "Fix km",
        correctedAt: "2026-06-11T10:00:00.000Z",
        supersededPreviousCorrection: false,
      },
      trip: makePreviewResponse().trip,
      workday: makePreviewResponse().workday,
      praemienImpact: "none",
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders correct mode dialog", async () => {
    await act(async () => {
      render(
        <TripRecoveryDialog
          isOpen={true}
          mode="correct"
          workdaySummaryId={SUMMARY_ID}
          originalTripId={TRIP_ID}
          context={baseContext}
          initialValues={initialValues}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );
    });
    expect(screen.getByTestId("trip-recovery-dialog")).toBeTruthy();
    expect(
      screen.getByText(
        "pages.summaries.admin.detail.tripRecovery.dialog.titleCorrect",
      ),
    ).toBeTruthy();
  });

  it("renders void mode dialog", async () => {
    await act(async () => {
      render(
        <TripRecoveryDialog
          isOpen={true}
          mode="void"
          workdaySummaryId={SUMMARY_ID}
          originalTripId={TRIP_ID}
          context={baseContext}
          initialValues={initialValues}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );
    });
    expect(
      screen.getByText(
        "pages.summaries.admin.detail.tripRecovery.dialog.titleVoid",
      ),
    ).toBeTruthy();
    expect(
      (screen.getByTestId("field-kmEnd") as HTMLInputElement).disabled,
    ).toBe(true);
  });

  it("renders forgotten mode dialog", async () => {
    await act(async () => {
      render(
        <TripRecoveryDialog
          isOpen={true}
          mode="forgotten"
          workdaySummaryId={SUMMARY_ID}
          context={baseContext}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );
    });
    expect(
      screen.getByText(
        "pages.summaries.admin.detail.tripRecovery.dialog.titleForgotten",
      ),
    ).toBeTruthy();
  });

  it("save is disabled without preview", async () => {
    await act(async () => {
      render(
        <TripRecoveryDialog
          isOpen={true}
          mode="correct"
          workdaySummaryId={SUMMARY_ID}
          originalTripId={TRIP_ID}
          context={baseContext}
          initialValues={initialValues}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );
    });
    expect(
      (screen.getByTestId("trip-recovery-save") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("calls preview API on preview click", async () => {
    await act(async () => {
      render(
        <TripRecoveryDialog
          isOpen={true}
          mode="correct"
          workdaySummaryId={SUMMARY_ID}
          originalTripId={TRIP_ID}
          context={baseContext}
          initialValues={initialValues}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );
    });

    fireEvent.change(screen.getByTestId("field-reason"), {
      target: { value: "Fix km reading" },
    });
    fireEvent.change(screen.getByTestId("field-kmEnd"), {
      target: { value: "125" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("trip-recovery-preview"));
    });

    expect(previewTripCorrection).toHaveBeenCalledOnce();
    expect(previewTripCorrection).toHaveBeenCalledWith(
      expect.objectContaining({
        correctionType: "correct",
        originalTripId: TRIP_ID,
        reason: "Fix km reading",
        effectiveKmEnd: 125,
      }),
    );
    expect(screen.getByTestId("trip-recovery-preview-panel")).toBeTruthy();
  });

  it("invalidates preview after field edit and disables save", async () => {
    await act(async () => {
      render(
        <TripRecoveryDialog
          isOpen={true}
          mode="correct"
          workdaySummaryId={SUMMARY_ID}
          originalTripId={TRIP_ID}
          context={baseContext}
          initialValues={initialValues}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );
    });

    fireEvent.change(screen.getByTestId("field-reason"), {
      target: { value: "Fix km reading" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("trip-recovery-preview"));
    });

    fireEvent.change(screen.getByTestId("field-kmEnd"), {
      target: { value: "130" },
    });

    expect(screen.getByTestId("trip-recovery-preview-stale")).toBeTruthy();
    expect(
      (screen.getByTestId("trip-recovery-save") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("saves after valid preview and shows toast", async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      render(
        <TripRecoveryDialog
          isOpen={true}
          mode="correct"
          workdaySummaryId={SUMMARY_ID}
          originalTripId={TRIP_ID}
          context={baseContext}
          initialValues={initialValues}
          onClose={onClose}
          onSaved={onSaved}
        />,
      );
    });

    fireEvent.change(screen.getByTestId("field-reason"), {
      target: { value: "Fix km reading" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("trip-recovery-preview"));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("trip-recovery-save"));
    });

    expect(createTripCorrection).toHaveBeenCalledOnce();
    expect(toastT.success).toHaveBeenCalledWith("toasts.workday.tripCorrectionSaved");
    expect(onSaved).toHaveBeenCalledWith(SUMMARY_ID);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows external stale warning when signal changes", async () => {
    const { rerender } = render(
      <TripRecoveryDialog
        isOpen={true}
        mode="correct"
        workdaySummaryId={SUMMARY_ID}
        originalTripId={TRIP_ID}
        context={baseContext}
        initialValues={initialValues}
        externalStaleSignal={0}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("field-reason"), {
      target: { value: "Fix km reading" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("trip-recovery-preview"));
    });

    rerender(
      <TripRecoveryDialog
        isOpen={true}
        mode="correct"
        workdaySummaryId={SUMMARY_ID}
        originalTripId={TRIP_ID}
        context={baseContext}
        initialValues={initialValues}
        externalStaleSignal={1}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByTestId("trip-recovery-external-stale")).toBeTruthy();
    expect(
      (screen.getByTestId("trip-recovery-save") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("does not expose raw ids in the UI", async () => {
    await act(async () => {
      render(
        <TripRecoveryDialog
          isOpen={true}
          mode="correct"
          workdaySummaryId={SUMMARY_ID}
          originalTripId={TRIP_ID}
          context={baseContext}
          initialValues={initialValues}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );
    });

    const dialogText =
      screen.getByTestId("trip-recovery-dialog").textContent ?? "";
    expect(dialogText).not.toContain(TRIP_ID);
    expect(dialogText).not.toContain(SUMMARY_ID);
    expect(dialogText).not.toContain("recoveryEventId");
    expect(dialogText).not.toContain("companyId");
  });
});
