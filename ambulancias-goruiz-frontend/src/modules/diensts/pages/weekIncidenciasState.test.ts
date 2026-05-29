import { describe, expect, it } from "vitest";

import type { WeeklyAssignmentSummaryData } from "../components/WeeklyAssignmentSummaryModal";
import {
  pruneAcknowledgedWeekIssueKeys,
  pruneSavedWeekIncidencias,
  pruneWeeklySummaryQueue,
} from "./weekIncidenciasState";

const teamSummary = (
  dienstNumber: number,
  weekStartDate: string,
): WeeklyAssignmentSummaryData => ({
  kind: "team",
  dienstNumber,
  weekStartDate,
  driverName: "A",
  medicName: "B",
  message: "m",
  updatedCount: 1,
  skippedByVacation: [{ date: "2030-01-06", role: "medic" }],
});

describe("weekIncidenciasState", () => {
  it("pruneSavedWeekIncidencias removes only the cleared dienst for that week", () => {
    const prev = {
      "2030-01-06": [teamSummary(1, "2030-01-06"), teamSummary(2, "2030-01-06")],
      "2030-01-13": [teamSummary(1, "2030-01-13")],
    };
    const next = pruneSavedWeekIncidencias(prev, "2030-01-06", 1);
    expect(next["2030-01-06"]).toEqual([teamSummary(2, "2030-01-06")]);
    expect(next["2030-01-13"]).toEqual(prev["2030-01-13"]);
  });

  it("pruneSavedWeekIncidencias deletes the week key when no summaries remain", () => {
    const prev = { "2030-01-06": [teamSummary(1, "2030-01-06")] };
    const next = pruneSavedWeekIncidencias(prev, "2030-01-06", 1);
    expect(next["2030-01-06"]).toBeUndefined();
  });

  it("pruneAcknowledgedWeekIssueKeys removes scoped keys for the cleared dienst", () => {
    const prev = {
      "2030-01-06": ["1:abs-driver-vacation-2030-01-06-2030-01-06-0", "2:wc-2030-01-07-2030-01-07-0"],
    };
    const next = pruneAcknowledgedWeekIssueKeys(prev, "2030-01-06", 1);
    expect(next["2030-01-06"]).toEqual(["2:wc-2030-01-07-2030-01-07-0"]);
  });

  it("pruneWeeklySummaryQueue drops queue entries for the cleared dienst/week", () => {
    const prev = [
      teamSummary(1, "2030-01-06"),
      teamSummary(2, "2030-01-06"),
      teamSummary(1, "2030-01-13"),
    ];
    const next = pruneWeeklySummaryQueue(prev, "2030-01-06", 1);
    expect(next).toEqual([teamSummary(2, "2030-01-06"), teamSummary(1, "2030-01-13")]);
  });
});
