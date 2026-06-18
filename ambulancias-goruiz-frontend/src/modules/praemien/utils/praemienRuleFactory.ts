import type { PraemienRule, PraemienRuleConfig } from "../domain/api";
import { DEFAULT_PRAEMIEN_RULES } from "./praemienRulePreview";

export const MAX_PRAEMIEN_RULES = 30;

export const PRAEMIEN_RULE_TYPES: PraemienRule["type"][] = [
  "km",
  "weekday",
  "dienstStartTime",
  "weekdayDienstStartTime",
  "weekdayPickupTime",
];

/** JS Date.getDay(): 0 = Sunday … 6 = Saturday */
export const PRAEMIEN_WEEKDAY_OPTIONS = [
  { value: 1, labelKey: "1" },
  { value: 2, labelKey: "2" },
  { value: 3, labelKey: "3" },
  { value: 4, labelKey: "4" },
  { value: 5, labelKey: "5" },
  { value: 6, labelKey: "6" },
  { value: 0, labelKey: "0" },
] as const;

export function clonePraemienRule(rule: PraemienRule): PraemienRule {
  if (rule.type === "weekday") {
    return { ...rule, weekdays: [...rule.weekdays] };
  }
  if (rule.type === "weekdayDienstStartTime") {
    return { ...rule, weekdays: [...rule.weekdays] };
  }
  if (rule.type === "weekdayPickupTime") {
    return { ...rule, weekdays: [...rule.weekdays] };
  }
  return { ...rule };
}

export function clonePraemienRules(rules: PraemienRuleConfig): PraemienRuleConfig {
  return {
    version: 1,
    rules: rules.rules.map((rule) => ({ ...rule })),
    cancelledTripPolicy: "excludeUnlessCountsTrip",
  };
}

export function samePraemienRules(
  a: PraemienRuleConfig,
  b: PraemienRuleConfig,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const PRAEMIEN_MULTIPLIER_STEP = 0.5;
export const DEFAULT_NEW_RULE_MULTIPLIER = 1;

export function createPraemienRule(type: PraemienRule["type"]): PraemienRule {
  const id = `rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  if (type === "km") {
    return {
      id,
      type,
      label: "",
      enabled: true,
      minKm: 0,
      maxKm: null,
      multiplier: DEFAULT_NEW_RULE_MULTIPLIER,
    };
  }
  if (type === "weekday") {
    return {
      id,
      type,
      label: "",
      enabled: true,
      weekdays: [1],
      multiplier: DEFAULT_NEW_RULE_MULTIPLIER,
    };
  }
  if (type === "dienstStartTime") {
    return {
      id,
      type,
      label: "",
      enabled: true,
      startTimeFrom: "12:00",
      startTimeTo: "14:00",
      multiplier: DEFAULT_NEW_RULE_MULTIPLIER,
    };
  }
  if (type === "weekdayPickupTime") {
    return {
      id,
      type,
      label: "",
      enabled: true,
      weekdays: [1],
      pickupTimeFrom: "12:00",
      pickupTimeTo: "14:00",
      multiplier: DEFAULT_NEW_RULE_MULTIPLIER,
    };
  }
  return {
    id,
    type: "weekdayDienstStartTime",
    label: "",
    enabled: true,
    weekdays: [1],
    startTimeFrom: "12:00",
    startTimeTo: "14:00",
    multiplier: DEFAULT_NEW_RULE_MULTIPLIER,
  };
}

export function changePraemienRuleType(
  rule: PraemienRule,
  type: PraemienRule["type"],
  mode: "create" | "edit" = "edit",
): PraemienRule {
  const next = createPraemienRule(type);
  if (mode === "create") {
    return {
      ...next,
      label: rule.label ?? "",
    };
  }
  return {
    ...next,
    id: rule.id,
    label: rule.label ?? next.label,
    enabled: rule.enabled,
    multiplier: rule.multiplier,
    effectiveFrom: rule.effectiveFrom ?? null,
    effectiveTo: rule.effectiveTo ?? null,
  };
}

export { DEFAULT_PRAEMIEN_RULES };
