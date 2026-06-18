import { describe, it, expect } from "vitest";
import {
  clonePraemienRule,
  createPraemienRule,
  DEFAULT_NEW_RULE_MULTIPLIER,
  PRAEMIEN_MULTIPLIER_STEP,
  PRAEMIEN_RULE_TYPES,
} from "./praemienRuleFactory";

describe("praemienRuleFactory", () => {
  it("includes weekdayPickupTime in supported rule types", () => {
    expect(PRAEMIEN_RULE_TYPES).toContain("weekdayPickupTime");
  });

  it("creates a clean km draft with default multiplier 1", () => {
    const rule = createPraemienRule("km");
    expect(rule.type).toBe("km");
    if (rule.type !== "km") return;
    expect(rule.label).toBe("");
    expect(rule.minKm).toBe(0);
    expect(rule.maxKm).toBeNull();
    expect(rule.multiplier).toBe(DEFAULT_NEW_RULE_MULTIPLIER);
  });

  it("creates weekdayPickupTime rule with expected fields", () => {
    const rule = createPraemienRule("weekdayPickupTime");
    expect(rule.type).toBe("weekdayPickupTime");
    if (rule.type !== "weekdayPickupTime") return;
    expect(rule.weekdays.length).toBeGreaterThan(0);
    expect(rule.pickupTimeFrom).toMatch(/^\d{2}:\d{2}$/);
    expect(rule.pickupTimeTo).toMatch(/^\d{2}:\d{2}$/);
    expect(rule.multiplier).toBe(DEFAULT_NEW_RULE_MULTIPLIER);
  });

  it("exposes 0.5 multiplier step constant", () => {
    expect(PRAEMIEN_MULTIPLIER_STEP).toBe(0.5);
  });

  it("clonePraemienRule returns an independent weekdays copy", () => {
    const rule = createPraemienRule("weekday");
    if (rule.type !== "weekday") return;
    const copy = clonePraemienRule(rule);
    if (copy.type !== "weekday") return;
    copy.weekdays.push(2);
    expect(rule.weekdays).not.toEqual(copy.weekdays);
  });
});
