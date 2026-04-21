import { describe, expect, it } from "vitest";
import {
  getNextCalendarMonth,
  shouldAttachPraemienEffectiveFromOnCompanyEdit,
} from "./praemienScheduleEdit";

describe("getNextCalendarMonth", () => {
  it("returns first day of next calendar month", () => {
    expect(getNextCalendarMonth(new Date(2026, 1, 15))).toEqual({
      year: 2026,
      month: 3,
    });
    expect(getNextCalendarMonth(new Date(2026, 11, 1))).toEqual({
      year: 2027,
      month: 1,
    });
  });
});

describe("shouldAttachPraemienEffectiveFromOnCompanyEdit", () => {
  it("false when initial mode unknown (create path)", () => {
    expect(
      shouldAttachPraemienEffectiveFromOnCompanyEdit({
        initialPraemienMode: null,
        praemienMode: "manual",
        praemienScheduleTouched: true,
      }),
    ).toBe(false);
  });

  it("true when target mode differs from loaded initial", () => {
    expect(
      shouldAttachPraemienEffectiveFromOnCompanyEdit({
        initialPraemienMode: "automatic",
        praemienMode: "manual",
        praemienScheduleTouched: false,
      }),
    ).toBe(true);
    expect(
      shouldAttachPraemienEffectiveFromOnCompanyEdit({
        initialPraemienMode: "manual",
        praemienMode: "automatic",
        praemienScheduleTouched: false,
      }),
    ).toBe(true);
  });

  it("false when unchanged and radios not touched", () => {
    expect(
      shouldAttachPraemienEffectiveFromOnCompanyEdit({
        initialPraemienMode: "manual",
        praemienMode: "manual",
        praemienScheduleTouched: false,
      }),
    ).toBe(false);
    expect(
      shouldAttachPraemienEffectiveFromOnCompanyEdit({
        initialPraemienMode: "automatic",
        praemienMode: "automatic",
        praemienScheduleTouched: false,
      }),
    ).toBe(false);
  });

  it("true when ending on manual after M→A→M (same as initial) but schedule was touched", () => {
    expect(
      shouldAttachPraemienEffectiveFromOnCompanyEdit({
        initialPraemienMode: "manual",
        praemienMode: "manual",
        praemienScheduleTouched: true,
      }),
    ).toBe(true);
  });

  it("false when automatic after A→M→A with only touch (no pending manual reschedule)", () => {
    expect(
      shouldAttachPraemienEffectiveFromOnCompanyEdit({
        initialPraemienMode: "automatic",
        praemienMode: "automatic",
        praemienScheduleTouched: true,
      }),
    ).toBe(false);
  });
});
