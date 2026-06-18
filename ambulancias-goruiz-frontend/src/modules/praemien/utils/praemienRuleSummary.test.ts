import { describe, expect, it } from "vitest";
import type { PraemienRule } from "../domain/api";
import {
  formatMultiplierSummary,
  formatRuleEffectiveFrom,
  formatRuleEffectiveTo,
  getRuleConditionChips,
  getRuleDisplayName,
  getRuleTypeLabel,
} from "./praemienRuleSummary";

import type { PraemienRuleTranslate } from "./praemienRuleSummary";

const t: PraemienRuleTranslate = (key, params) => {
  if (params) {
    return `${key}:${JSON.stringify(params)}`;
  }
  return key;
};

describe("praemienRuleSummary", () => {
  it("formats multiplier chip", () => {
    expect(formatMultiplierSummary(1.5)).toBe("×1.5");
  });

  it("summarizes km rule with open end", () => {
    const rule: PraemienRule = {
      id: "km1",
      type: "km",
      label: "Long trip",
      enabled: true,
      minKm: 20,
      maxKm: null,
      multiplier: 2,
    };
    const chips = getRuleConditionChips(rule, t);
    expect(chips).toHaveLength(1);
    expect(chips[0].label).toContain("20");
    expect(chips[0].label).toContain("kmOpenEnd");
  });

  it("summarizes weekday + dienst time rule", () => {
    const rule: PraemienRule = {
      id: "wd1",
      type: "weekdayDienstStartTime",
      label: "Weekend",
      enabled: true,
      weekdays: [0, 6],
      startTimeFrom: "13:00",
      startTimeTo: "17:00",
      multiplier: 1.5,
    };
    const chips = getRuleConditionChips(rule, t);
    expect(chips).toHaveLength(2);
    expect(chips[0].key).toBe("weekdays");
    expect(chips[1].key).toBe("dienstTime");
  });

  it("summarizes weekdayPickupTime rule", () => {
    const rule: PraemienRule = {
      id: "pickup1",
      type: "weekdayPickupTime",
      label: "Pickup window",
      enabled: true,
      weekdays: [1, 3, 5],
      pickupTimeFrom: "08:00",
      pickupTimeTo: "10:00",
      multiplier: 1.25,
    };
    const chips = getRuleConditionChips(rule, t);
    expect(chips).toHaveLength(2);
    expect(chips[1].key).toBe("pickupTime");
    expect(chips[1].label).toContain("08:00");
  });

  it("uses fallback name when label is empty", () => {
    const rule: PraemienRule = {
      id: "x",
      type: "weekday",
      label: "  ",
      enabled: true,
      weekdays: [1],
      multiplier: 1,
    };
    expect(getRuleDisplayName(rule, t)).toBe("pages.praemien.adminRules.unnamedRule");
  });

  it("maps rule type labels", () => {
    expect(getRuleTypeLabel("weekdayPickupTime", t)).toBe(
      "pages.praemien.adminRules.ruleTypes.weekdayPickupTime",
    );
  });

  it("formats validity date columns", () => {
    const openRule: PraemienRule = {
      id: "open",
      type: "km",
      label: "Open",
      enabled: true,
      minKm: 0,
      maxKm: null,
      multiplier: 1,
    };
    expect(formatRuleEffectiveFrom(openRule, t)).toBe(
      "pages.praemien.adminRules.table.emptyCell",
    );
    expect(formatRuleEffectiveTo(openRule, t)).toBe(
      "pages.praemien.adminRules.table.emptyCell",
    );

    const scheduledRule: PraemienRule = {
      ...openRule,
      effectiveFrom: "2027-01-01",
    };
    expect(formatRuleEffectiveFrom(scheduledRule, t)).toBe("2027-01-01");
    expect(formatRuleEffectiveTo(scheduledRule, t)).toBe(
      "pages.praemien.adminRules.table.noEndDate",
    );

    const boundedRule: PraemienRule = {
      ...scheduledRule,
      effectiveTo: "2027-12-31",
    };
    expect(formatRuleEffectiveTo(boundedRule, t)).toBe("2027-12-31");
  });

  it("does not include validity dates in condition chips", () => {
    const rule: PraemienRule = {
      id: "dated",
      type: "km",
      label: "Dated",
      enabled: true,
      minKm: 10,
      maxKm: null,
      multiplier: 2,
      effectiveFrom: "2027-01-01",
      effectiveTo: "2027-12-31",
    };
    const chips = getRuleConditionChips(rule, t);
    expect(chips).toHaveLength(1);
    expect(chips[0].key).toBe("km");
    expect(chips.some((chip) => chip.key === "effectiveFrom")).toBe(false);
  });
});
