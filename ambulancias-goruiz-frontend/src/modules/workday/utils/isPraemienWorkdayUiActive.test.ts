import { describe, expect, it } from "vitest";
import { isPraemienWorkdayUiActive } from "./isPraemienWorkdayUiActive";

describe("isPraemienWorkdayUiActive", () => {
  const base = { praemienEnabled: true };

  it("automatic with null effectiveFrom stays active (classic company)", () => {
    expect(
      isPraemienWorkdayUiActive({
        ...base,
        praemienMode: "automatic",
        praemienModeEffectiveFrom: null,
        now: new Date(2026, 2, 10),
      }),
    ).toBe(true);
  });

  it("manual before effective month uses automatic-style workday UI", () => {
    expect(
      isPraemienWorkdayUiActive({
        ...base,
        praemienMode: "manual",
        praemienModeEffectiveFrom: { year: 2026, month: 4 },
        now: new Date(2026, 2, 10),
      }),
    ).toBe(true);
  });

  it("manual on/after effective month hides workday prämie UI", () => {
    expect(
      isPraemienWorkdayUiActive({
        ...base,
        praemienMode: "manual",
        praemienModeEffectiveFrom: { year: 2026, month: 3 },
        now: new Date(2026, 1, 28),
      }),
    ).toBe(true);
    expect(
      isPraemienWorkdayUiActive({
        ...base,
        praemienMode: "manual",
        praemienModeEffectiveFrom: { year: 2026, month: 3 },
        now: new Date(2026, 2, 1),
      }),
    ).toBe(false);
  });

  it("stored automatic ignores effectiveFrom (documented: deferred automatic workday is not modeled separately)", () => {
    expect(
      isPraemienWorkdayUiActive({
        ...base,
        praemienMode: "automatic",
        praemienModeEffectiveFrom: { year: 2026, month: 6 },
        now: new Date(2026, 2, 10),
      }),
    ).toBe(true);
  });
});
