import { describe, expect, it } from "vitest";
import type { PraemienRule } from "../domain/api";
import {
  getPraemienRuleLifecycleStatus,
  isPraemienRuleEffectiveOnDate,
} from "./praemienRuleValidity";

const baseRule: PraemienRule = {
  type: "km",
  label: "Test",
  enabled: true,
  minKm: 0,
  maxKm: null,
  multiplier: 1,
};

describe("praemienRuleValidity", () => {
  it("treats missing dates as always effective", () => {
    expect(isPraemienRuleEffectiveOnDate(baseRule, "2027-06-01")).toBe(true);
  });

  it("respects inclusive start and end boundaries", () => {
    const rule: PraemienRule = {
      ...baseRule,
      effectiveFrom: "2027-01-01",
      effectiveTo: "2027-12-31",
    };
    expect(isPraemienRuleEffectiveOnDate(rule, "2026-12-31")).toBe(false);
    expect(isPraemienRuleEffectiveOnDate(rule, "2027-01-01")).toBe(true);
    expect(isPraemienRuleEffectiveOnDate(rule, "2027-12-31")).toBe(true);
    expect(isPraemienRuleEffectiveOnDate(rule, "2028-01-01")).toBe(false);
  });

  it("applies indefinitely when only effectiveFrom is set", () => {
    const rule: PraemienRule = {
      ...baseRule,
      effectiveFrom: "2027-01-01",
      effectiveTo: null,
    };
    expect(isPraemienRuleEffectiveOnDate(rule, "2035-01-01")).toBe(true);
  });

  it("derives lifecycle status badges", () => {
    expect(
      getPraemienRuleLifecycleStatus({ ...baseRule, enabled: false }, "2027-06-01"),
    ).toBe("disabled");
    expect(
      getPraemienRuleLifecycleStatus(
        { ...baseRule, effectiveFrom: "2028-01-01" },
        "2027-06-01",
      ),
    ).toBe("scheduled");
    expect(
      getPraemienRuleLifecycleStatus(
        { ...baseRule, effectiveTo: "2026-12-31" },
        "2027-06-01",
      ),
    ).toBe("expired");
    expect(getPraemienRuleLifecycleStatus(baseRule, "2027-06-01")).toBe("active");
  });
});
