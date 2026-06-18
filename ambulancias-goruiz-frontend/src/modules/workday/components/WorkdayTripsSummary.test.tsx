import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import WorkdayTripsSummary from "./WorkdayTripsSummary";
import type { AssignedDayFull } from "../../diensts";
import type { Trip } from "../domain/types/trip";
import type { PraemienRuleConfig } from "../../praemien/domain/api";
import * as praemienRulePreview from "../../praemien/utils/praemienRulePreview";
import {
  calculatePraemienPreviewTotal,
  getPraemienPreviewMultiplier,
} from "../../praemien/utils/praemienRulePreview";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const thursdayDate = "2025-06-12";

const assignedDay = {
  date: thursdayDate,
  startTime: "08:00",
  endTime: "16:00",
  assignmentId: "a1",
  driver: { _id: "d1", name: "Ana", lastName: "García" },
  medic: { _id: "m1", name: "Luis", lastName: "Pérez" },
} as AssignedDayFull;

const baseTrip: Trip = {
  _id: "t1",
  date: thursdayDate,
  assignmentId: "a1",
  driver: "d1",
  medic: "m1",
  auftragNumber: "A-100",
  patientName: "Patient",
  fromAddress: "A",
  toAddress: "B",
  timeWarning: "08:00",
  timeAtHome: "08:10",
  timePickup: "08:20",
  timeArrival: "08:40",
  timeEnd: "09:00",
  kmStart: 100,
  kmEnd: 101,
  wasCancelled: false,
  cancelledAtPickup: false,
  countsTrip: 1,
  countsForSummary: true,
};

const thursdayX2Rules: PraemienRuleConfig = {
  version: 1,
  cancelledTripPolicy: "excludeUnlessCountsTrip",
  rules: [
    {
      id: "thursday-x2",
      type: "weekday",
      label: "Jueves x2",
      enabled: true,
      weekdays: [4],
      multiplier: 2,
    },
  ],
};

const baseProps = {
  assignedDay,
  onOpenTrip: vi.fn(),
  vehicleConfirmed: true,
  isClosingDay: false,
  onCloseAndSend: vi.fn(),
  isOpen: true,
  onToggleOpen: vi.fn(),
};

describe("WorkdayTripsSummary praemien preview", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows x2 for a 1 km Thursday trip when a weekday x2 rule is configured", async () => {
    render(
      <WorkdayTripsSummary
        {...baseProps}
        trips={[baseTrip]}
        praemienRules={thursdayX2Rules}
      />,
    );

    expect(screen.getByText("2x")).toBeTruthy();
    expect(screen.queryByText("1x")).toBeNull();
  });

  it("uses assignedDay.date as the dienst date basis for preview", () => {
    const fridayAssignedDay = { ...assignedDay, date: "2025-06-13" };
    render(
      <WorkdayTripsSummary
        {...baseProps}
        assignedDay={fridayAssignedDay}
        trips={[baseTrip]}
        praemienRules={thursdayX2Rules}
      />,
    );

    expect(screen.getByText("1x")).toBeTruthy();
    expect(screen.queryByText("2x")).toBeNull();
  });

  it("falls back to legacy default rules when configurable rules are unavailable", () => {
    const longTrip: Trip = { ...baseTrip, kmStart: 0, kmEnd: 22 };
    render(
      <WorkdayTripsSummary
        {...baseProps}
        trips={[longTrip]}
        praemienRules={null}
      />,
    );

    const expected = getPraemienPreviewMultiplier({
      trip: longTrip,
      dienstDate: assignedDay.date,
      dienstStartTime: assignedDay.startTime,
      rules: null,
    });

    expect(screen.getByText(`${expected}x`)).toBeTruthy();
    expect(expected).toBe(2);
  });

  it("preview total matches calculatePraemienPreviewTotal for the same inputs", () => {
    const trips: Trip[] = [
      baseTrip,
      { ...baseTrip, _id: "t2", auftragNumber: "A-101", kmStart: 200, kmEnd: 215 },
    ];

    render(
      <WorkdayTripsSummary
        {...baseProps}
        trips={trips}
        praemienRules={thursdayX2Rules}
      />,
    );

    const expectedTotal = calculatePraemienPreviewTotal({
      trips,
      dienstDate: assignedDay.date,
      dienstStartTime: assignedDay.startTime,
      rules: thursdayX2Rules,
    });

    const rowMultipliers = trips.map((trip) =>
      getPraemienPreviewMultiplier({
        trip,
        dienstDate: assignedDay.date,
        dienstStartTime: assignedDay.startTime,
        rules: thursdayX2Rules,
      }),
    );
    const sumFromRows = rowMultipliers.reduce((sum, value) => sum + value, 0);

    expect(sumFromRows).toBe(expectedTotal);
    expect(screen.getAllByText("2x")).toHaveLength(2);
  });

  it("delegates multiplier calculation to getPraemienPreviewMultiplier", () => {
    const spy = vi.spyOn(praemienRulePreview, "getPraemienPreviewMultiplier");

    render(
      <WorkdayTripsSummary
        {...baseProps}
        trips={[baseTrip]}
        praemienRules={thursdayX2Rules}
      />,
    );

    expect(spy).toHaveBeenCalledWith({
      trip: baseTrip,
      dienstDate: assignedDay.date,
      dienstStartTime: assignedDay.startTime,
      rules: thursdayX2Rules,
    });
  });
});
