import { describe, expect, it } from "vitest";
import { isPraemienManualEntryPhaseActive } from "./isPraemienManualEntryPhaseActive";

describe("isPraemienManualEntryPhaseActive", () => {
  const base = { praemienEnabled: true };

  it("never active in automatic mode", () => {
    expect(
      isPraemienManualEntryPhaseActive({
        ...base,
        praemienMode: "automatic",
        praemienModeEffectiveFrom: { year: 2026, month: 1 },
        now: new Date(2026, 5, 1),
      }),
    ).toBe(false);
  });

  it("manual scheduled for next month is not active early", () => {
    expect(
      isPraemienManualEntryPhaseActive({
        ...base,
        praemienMode: "manual",
        praemienModeEffectiveFrom: { year: 2026, month: 5 },
        now: new Date(2026, 3, 15),
      }),
    ).toBe(false);
  });

  it("manual active on/after first day of effective month", () => {
    expect(
      isPraemienManualEntryPhaseActive({
        ...base,
        praemienMode: "manual",
        praemienModeEffectiveFrom: { year: 2026, month: 4 },
        now: new Date(2026, 2, 30),
      }),
    ).toBe(false);
    expect(
      isPraemienManualEntryPhaseActive({
        ...base,
        praemienMode: "manual",
        praemienModeEffectiveFrom: { year: 2026, month: 4 },
        now: new Date(2026, 3, 1),
      }),
    ).toBe(true);
  });

  it("manual without effectiveFrom is inactive", () => {
    expect(
      isPraemienManualEntryPhaseActive({
        ...base,
        praemienMode: "manual",
        praemienModeEffectiveFrom: null,
        now: new Date(2026, 4, 1),
      }),
    ).toBe(false);
  });
});
