import type { PraemienRule } from "../domain/api";
import { PRAEMIEN_WEEKDAY_OPTIONS } from "./praemienRuleFactory";

export type PraemienRuleTranslate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export type RuleConditionChip = {
  key: string;
  label: string;
};

function weekdayLetters(rule: PraemienRule, t: PraemienRuleTranslate): string {
  if (
    rule.type !== "weekday" &&
    rule.type !== "weekdayDienstStartTime" &&
    rule.type !== "weekdayPickupTime"
  ) {
    return "";
  }
  const labels = PRAEMIEN_WEEKDAY_OPTIONS.filter((day) =>
    rule.weekdays.includes(day.value),
  ).map((day) => t(`pages.praemien.adminRules.weekdayShort.${day.labelKey}`));
  return labels.join(" ");
}

export function getRuleTypeLabel(type: PraemienRule["type"], t: PraemienRuleTranslate): string {
  return t(`pages.praemien.adminRules.ruleTypes.${type}`);
}

export function formatMultiplierSummary(multiplier: number): string {
  return `×${multiplier}`;
}

export function getRuleConditionChips(
  rule: PraemienRule,
  t: PraemienRuleTranslate,
): RuleConditionChip[] {
  const chips: RuleConditionChip[] = [];

  if (rule.type === "km") {
    const maxLabel =
      rule.maxKm == null
        ? t("pages.praemien.adminRules.chips.kmOpenEnd")
        : `${rule.maxKm} km`;
    chips.push({
      key: "km",
      label: t("pages.praemien.adminRules.chips.kmRange", {
        min: rule.minKm,
        max: maxLabel,
      }),
    });
    return chips;
  }

  if (rule.type === "weekday") {
    const days = weekdayLetters(rule, t);
    if (days) {
      chips.push({ key: "weekdays", label: days });
    }
    return chips;
  }

  if (rule.type === "dienstStartTime") {
    chips.push({
      key: "dienstTime",
      label: t("pages.praemien.adminRules.chips.dienstTime", {
        from: rule.startTimeFrom,
        to: rule.startTimeTo,
      }),
    });
    return chips;
  }

  if (rule.type === "weekdayDienstStartTime") {
    const days = weekdayLetters(rule, t);
    if (days) {
      chips.push({ key: "weekdays", label: days });
    }
    chips.push({
      key: "dienstTime",
      label: t("pages.praemien.adminRules.chips.dienstTime", {
        from: rule.startTimeFrom,
        to: rule.startTimeTo,
      }),
    });
    return chips;
  }

  if (rule.type === "weekdayPickupTime") {
    const days = weekdayLetters(rule, t);
    if (days) {
      chips.push({ key: "weekdays", label: days });
    }
    chips.push({
      key: "pickupTime",
      label: t("pages.praemien.adminRules.chips.pickupTime", {
        from: rule.pickupTimeFrom,
        to: rule.pickupTimeTo,
      }),
    });
  }

  return chips;
}

export function formatRuleEffectiveFrom(
  rule: Pick<PraemienRule, "effectiveFrom">,
  t: PraemienRuleTranslate,
): string {
  const from = rule.effectiveFrom?.trim();
  return from || t("pages.praemien.adminRules.table.emptyCell");
}

export function formatRuleEffectiveTo(
  rule: Pick<PraemienRule, "effectiveFrom" | "effectiveTo">,
  t: PraemienRuleTranslate,
): string {
  const to = rule.effectiveTo?.trim();
  if (to) return to;
  if (rule.effectiveFrom?.trim()) {
    return t("pages.praemien.adminRules.table.noEndDate");
  }
  return t("pages.praemien.adminRules.table.emptyCell");
}

export function getRuleDisplayName(rule: PraemienRule, t: PraemienRuleTranslate): string {
  const trimmed = rule.label?.trim();
  if (trimmed) return trimmed;
  return t("pages.praemien.adminRules.unnamedRule");
}
