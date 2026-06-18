import { describe, expect, it } from "vitest";
import type { PraemienRuleConfig } from "../domain/api";
import { DEFAULT_PRAEMIEN_RULES } from "./praemienRuleFactory";
import { validatePraemienRuleConfig, isValidMultiplierStep } from "./validatePraemienRules";

function baseConfig(rules: PraemienRuleConfig["rules"]): PraemienRuleConfig {
  return {
    version: 1,
    rules,
    cancelledTripPolicy: "excludeUnlessCountsTrip",
  };
}

describe("validatePraemienRules", () => {
  it("accepts default rules when labels are present", () => {
    const issues = validatePraemienRuleConfig(DEFAULT_PRAEMIEN_RULES);
    expect(issues).toHaveLength(0);
  });

  it("requires rule name", () => {
    const config = baseConfig([
      {
        id: "r1",
        type: "km",
        label: "",
        enabled: true,
        minKm: 10,
        maxKm: null,
        multiplier: 1.5,
      },
    ]);
    const issues = validatePraemienRuleConfig(config);
    expect(issues.some((i) => i.field === "label")).toBe(true);
  });

  it("rejects maxKm below minKm", () => {
    const config = baseConfig([
      {
        id: "r1",
        type: "km",
        label: "Km rule",
        enabled: true,
        minKm: 30,
        maxKm: 20,
        multiplier: 1.5,
      },
    ]);
    const issues = validatePraemienRuleConfig(config);
    expect(issues.some((i) => i.field === "maxKm")).toBe(true);
  });

  it("requires at least one weekday", () => {
    const config = baseConfig([
      {
        id: "r1",
        type: "weekday",
        label: "Weekday rule",
        enabled: true,
        weekdays: [],
        multiplier: 1.5,
      },
    ]);
    const issues = validatePraemienRuleConfig(config);
    expect(issues.some((i) => i.field === "weekdays")).toBe(true);
  });

  it("rejects inverted dienst time range", () => {
    const config = baseConfig([
      {
        id: "r1",
        type: "dienstStartTime",
        label: "Time rule",
        enabled: true,
        startTimeFrom: "18:00",
        startTimeTo: "08:00",
        multiplier: 1.5,
      },
    ]);
    const issues = validatePraemienRuleConfig(config);
    expect(issues.some((i) => i.field === "startTimeTo")).toBe(true);
  });

  it("validates weekdayPickupTime pickup range order", () => {
    const config = baseConfig([
      {
        id: "r1",
        type: "weekdayPickupTime",
        label: "Pickup rule",
        enabled: true,
        weekdays: [1],
        pickupTimeFrom: "15:00",
        pickupTimeTo: "10:00",
        multiplier: 1.5,
      },
    ]);
    const issues = validatePraemienRuleConfig(config);
    expect(issues.some((i) => i.field === "pickupTimeTo")).toBe(true);
  });

  it("rejects multiplier above backend max", () => {
    const config = baseConfig([
      {
        id: "r1",
        type: "weekday",
        label: "High multiplier",
        enabled: true,
        weekdays: [1],
        multiplier: 11,
      },
    ]);
    const issues = validatePraemienRuleConfig(config);
    expect(issues.some((i) => i.field === "multiplier")).toBe(true);
  });

  it("accepts multipliers on 0.5 steps", () => {
    for (const multiplier of [0.5, 1, 1.5, 2]) {
      expect(isValidMultiplierStep(multiplier)).toBe(true);
      const issues = validatePraemienRuleConfig(
        baseConfig([
          {
            id: "r1",
            type: "weekday",
            label: "Step rule",
            enabled: true,
            weekdays: [1],
            multiplier,
          },
        ]),
      );
      expect(issues.some((i) => i.field === "multiplier")).toBe(false);
    }
  });

  it("rejects multipliers outside 0.5 steps", () => {
    expect(isValidMultiplierStep(1.3)).toBe(false);
    const issues = validatePraemienRuleConfig(
      baseConfig([
        {
          id: "r1",
          type: "weekday",
          label: "Bad step",
          enabled: true,
          weekdays: [1],
          multiplier: 1.3,
        },
      ]),
    );
    expect(issues.some((i) => i.messageKey.includes("multiplierStep"))).toBe(true);
  });

  it("rejects inverted validity date range", () => {
    const issues = validatePraemienRuleConfig(
      baseConfig([
        {
          id: "r1",
          type: "km",
          label: "Date rule",
          enabled: true,
          minKm: 0,
          maxKm: null,
          multiplier: 1,
          effectiveFrom: "2027-12-31",
          effectiveTo: "2027-01-01",
        },
      ]),
    );
    expect(issues.some((i) => i.field === "effectiveTo")).toBe(true);
  });
});
