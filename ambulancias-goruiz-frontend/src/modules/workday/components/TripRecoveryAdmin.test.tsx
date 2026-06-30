/**
 * Phase 4.4 — Trip Recovery integration in AdminWorkdaySummaryGroupContent.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act, fireEvent, waitFor } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../domain/workdayRecoveryApi", () => ({
  getEffectiveWorkdaySummary: vi.fn(),
  createWorkdayCorrection: vi.fn(),
}));

vi.mock("../domain/tripRecoveryApi", () => ({
  getEffectiveTripsForWorkdaySummary: vi.fn(),
  previewTripCorrection: vi.fn(),
  createTripCorrection: vi.fn(),
}));

vi.mock("../../../hooks/usePraemienWorkdayUiActive", () => ({
  usePraemienWorkdayUiActive: () => false,
}));

vi.mock("../utils/workdayEvents", async (importOriginal) => {
  const mod =
    await importOriginal<typeof import("../utils/workdayEvents")>();
  return {
    ...mod,
    emitWorkdaySummariesChanged: vi.fn(mod.emitWorkdaySummariesChanged),
  };
});

import { getEffectiveWorkdaySummary } from "../domain/workdayRecoveryApi";
import { getEffectiveTripsForWorkdaySummary } from "../domain/tripRecoveryApi";
import { emitWorkdaySummariesChanged } from "../utils/workdayEvents";
import AdminWorkdaySummaryGroupContent from "./AdminWorkdaySummaryGroupContent";
import type { WorkdaySummary } from "../domain";
import type { EffectiveWorkdaySummaryResponse } from "../domain/workdayRecoveryApi";
import type { EffectiveTripsListResponse } from "../domain/tripRecoveryApi";

const SUMMARY_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const TRIP_ID = "cccccccccccccccccccccccc";
const TRIP_CORRECTED_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const TRIP_VOIDED_ID = "dddddddddddddddddddddddd";

const makeEffectiveWorkday = (): EffectiveWorkdaySummaryResponse => ({
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
});

const makeEffectiveTrips = (): EffectiveTripsListResponse => ({
  workdaySummaryId: SUMMARY_ID,
  assignmentId: "assign-1",
  date: "2026-06-10",
  workerIds: [],
  effectiveTripCount: 3,
  trips: [
    {
      tripKey: TRIP_ID,
      type: "original",
      isIncludedInEffectiveCount: true,
      values: {
        countsTrip: 1,
        wasCancelled: false,
        kmStart: 100,
        kmEnd: 120,
        timeWarning: "08:30",
      },
    },
    {
      tripKey: TRIP_CORRECTED_ID,
      type: "corrected",
      isIncludedInEffectiveCount: true,
      values: {
        countsTrip: 1,
        wasCancelled: false,
        kmStart: 120,
        kmEnd: 140,
        timeWarning: "10:00",
      },
      changedFields: ["kmEnd"],
    },
    {
      tripKey: "forgotten-row",
      type: "forgotten",
      isIncludedInEffectiveCount: true,
      values: {
        countsTrip: 1,
        wasCancelled: false,
        kmStart: 140,
        kmEnd: 160,
        timeWarning: "12:00",
      },
    },
    {
      tripKey: TRIP_VOIDED_ID,
      type: "voided",
      isIncludedInEffectiveCount: false,
      values: {
        countsTrip: 0,
        wasCancelled: false,
        kmStart: 160,
        kmEnd: 180,
        timeWarning: "14:00",
      },
    },
  ],
});

const finalSummary: WorkdaySummary = {
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
  trips: [
    {
      assignmentId: "assign-1",
      date: "2026-06-10",
      driver: "d",
      medic: "m",
      auftragNumber: "999",
      patientName: "Should Not Appear",
      fromAddress: "Secret St",
      toAddress: "Hidden Ave",
      timeWarning: "08:30",
      timeAtHome: "",
      timePickup: "",
      timeArrival: "",
      timeEnd: "",
      kmStart: 100,
      kmEnd: 120,
      countsForSummary: true,
      wasCancelled: false,
      cancelledAtPickup: false,
    },
  ],
};

const partialSummary: WorkdaySummary = {
  ...finalSummary,
  _id: "bbbbbbbbbbbbbbbbbbbbbbbb",
  isFinalClosure: false,
};

describe("AdminWorkdaySummaryGroupContent — Trip Recovery", () => {
  beforeEach(() => {
    vi.mocked(getEffectiveWorkdaySummary).mockResolvedValue(makeEffectiveWorkday());
    vi.mocked(getEffectiveTripsForWorkdaySummary).mockResolvedValue(
      makeEffectiveTrips(),
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders effective trips table for final summaries", async () => {
    await act(async () => {
      render(<AdminWorkdaySummaryGroupContent summaries={[finalSummary]} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("effective-trips-table")).toBeTruthy();
    });
    expect(screen.getByTestId("effective-trip-row-0")).toBeTruthy();
  });

  it("shows trip recovery badges", async () => {
    await act(async () => {
      render(<AdminWorkdaySummaryGroupContent summaries={[finalSummary]} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("trip-badge-corrected")).toBeTruthy();
    });
    expect(screen.getByTestId("trip-badge-forgotten")).toBeTruthy();
    expect(screen.getByTestId("trip-badge-voided")).toBeTruthy();
  });

  it("does not show trip recovery controls for partial summaries", async () => {
    await act(async () => {
      render(<AdminWorkdaySummaryGroupContent summaries={[partialSummary]} />);
    });

    expect(screen.queryByTestId("effective-trips-table")).toBeNull();
    expect(screen.queryByTestId("add-forgotten-trip-button")).toBeNull();
    expect(screen.queryByTestId("trip-correct-0")).toBeNull();
  });

  it("opens correct dialog from row action", async () => {
    await act(async () => {
      render(<AdminWorkdaySummaryGroupContent summaries={[finalSummary]} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("trip-correct-0")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("trip-correct-0"));
    expect(screen.getByTestId("trip-recovery-dialog")).toBeTruthy();
    expect(
      screen.getByText(
        "pages.summaries.admin.detail.tripRecovery.dialog.titleCorrect",
      ),
    ).toBeTruthy();
  });

  it("opens void dialog from row action", async () => {
    await act(async () => {
      render(<AdminWorkdaySummaryGroupContent summaries={[finalSummary]} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("trip-void-0")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("trip-void-0"));
    expect(
      screen.getByText(
        "pages.summaries.admin.detail.tripRecovery.dialog.titleVoid",
      ),
    ).toBeTruthy();
  });

  it("opens forgotten dialog from toolbar", async () => {
    await act(async () => {
      render(<AdminWorkdaySummaryGroupContent summaries={[finalSummary]} />);
    });

    fireEvent.click(screen.getByTestId("add-forgotten-trip-button"));
    expect(
      screen.getByText(
        "pages.summaries.admin.detail.tripRecovery.dialog.titleForgotten",
      ),
    ).toBeTruthy();
  });

  it("does not display raw ObjectIds or PII from original trips", async () => {
    await act(async () => {
      render(<AdminWorkdaySummaryGroupContent summaries={[finalSummary]} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("effective-trip-row-1")).toBeTruthy();
    });

    const tableText =
      screen.getByTestId("effective-trips-table").textContent ?? "";
    expect(tableText).not.toContain(TRIP_ID);
    expect(tableText).not.toContain("Should Not Appear");
    expect(tableText).not.toContain("Secret St");
    expect(tableText).not.toContain("companyId");
    expect(tableText).not.toContain("recoveryEventId");
  });

  it("keeps existing workday correction button for final summaries", async () => {
    await act(async () => {
      render(<AdminWorkdaySummaryGroupContent summaries={[finalSummary]} />);
    });
    expect(screen.getByTestId("correct-workday-button")).toBeTruthy();
  });

  it("refreshes effective trips on workday summaries changed", async () => {
    await act(async () => {
      render(<AdminWorkdaySummaryGroupContent summaries={[finalSummary]} />);
    });

    await waitFor(() => {
      expect(getEffectiveTripsForWorkdaySummary).toHaveBeenCalled();
    });

    const initialCalls = vi.mocked(getEffectiveTripsForWorkdaySummary).mock.calls
      .length;

    await act(async () => {
      emitWorkdaySummariesChanged();
    });

    await waitFor(() => {
      expect(
        vi.mocked(getEffectiveTripsForWorkdaySummary).mock.calls.length,
      ).toBeGreaterThan(initialCalls);
    });
  });
});
