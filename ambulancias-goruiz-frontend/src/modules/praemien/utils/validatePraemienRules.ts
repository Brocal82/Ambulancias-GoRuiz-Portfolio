import type { PraemienRule, PraemienRuleConfig } from "../domain/api";
import { MAX_PRAEMIEN_RULES, PRAEMIEN_MULTIPLIER_STEP } from "./praemienRuleFactory";
import {
  isValidPraemienRuleDate,
  PRAEMIEN_RULE_DATE_RE,
} from "./praemienRuleValidity";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidMultiplierStep(multiplier: number): boolean {
  if (!Number.isFinite(multiplier)) return false;
  const doubled = multiplier / PRAEMIEN_MULTIPLIER_STEP;
  return Math.abs(doubled - Math.round(doubled)) < 1e-9;
}

export type PraemienRuleValidationIssue = {
  ruleIndex?: number;
  field?: string;
  messageKey: string;
};

function validateRule(rule: PraemienRule, index: number): PraemienRuleValidationIssue[] {
  const issues: PraemienRuleValidationIssue[] = [];
  const label = rule.label?.trim() ?? "";

  if (!label) {
    issues.push({
      ruleIndex: index,
      field: "label",
      messageKey: "pages.praemien.adminRules.validation.labelRequired",
    });
  } else if (label.length > 80) {
    issues.push({
      ruleIndex: index,
      field: "label",
      messageKey: "pages.praemien.adminRules.validation.labelMaxLength",
    });
  }

  if (rule.multiplier < 0 || rule.multiplier > 10) {
    issues.push({
      ruleIndex: index,
      field: "multiplier",
      messageKey: "pages.praemien.adminRules.validation.multiplierRange",
    });
  } else if (!isValidMultiplierStep(rule.multiplier)) {
    issues.push({
      ruleIndex: index,
      field: "multiplier",
      messageKey: "pages.praemien.adminRules.validation.multiplierStep",
    });
  }

  if (rule.effectiveFrom != null && rule.effectiveFrom !== "") {
    if (!isValidPraemienRuleDate(rule.effectiveFrom)) {
      issues.push({
        ruleIndex: index,
        field: "effectiveFrom",
        messageKey: "pages.praemien.adminRules.validation.invalidDate",
      });
    }
  }
  if (rule.effectiveTo != null && rule.effectiveTo !== "") {
    if (!isValidPraemienRuleDate(rule.effectiveTo)) {
      issues.push({
        ruleIndex: index,
        field: "effectiveTo",
        messageKey: "pages.praemien.adminRules.validation.invalidDate",
      });
    }
  }
  if (
    rule.effectiveFrom &&
    PRAEMIEN_RULE_DATE_RE.test(rule.effectiveFrom) &&
    rule.effectiveTo &&
    PRAEMIEN_RULE_DATE_RE.test(rule.effectiveTo) &&
    rule.effectiveTo < rule.effectiveFrom
  ) {
    issues.push({
      ruleIndex: index,
      field: "effectiveTo",
      messageKey: "pages.praemien.adminRules.validation.dateRangeOrder",
    });
  }

  if (rule.type === "km") {
    if (rule.minKm < 0 || rule.minKm > 10000) {
      issues.push({
        ruleIndex: index,
        field: "minKm",
        messageKey: "pages.praemien.adminRules.validation.kmRange",
      });
    }
    if (rule.maxKm != null) {
      if (rule.maxKm < 0 || rule.maxKm > 10000) {
        issues.push({
          ruleIndex: index,
          field: "maxKm",
          messageKey: "pages.praemien.adminRules.validation.kmRange",
        });
      }
      if (rule.maxKm < rule.minKm) {
        issues.push({
          ruleIndex: index,
          field: "maxKm",
          messageKey: "pages.praemien.adminRules.validation.maxKmGteMinKm",
        });
      }
    }
    return issues;
  }

  if (rule.type === "weekday") {
    if (!rule.weekdays.length) {
      issues.push({
        ruleIndex: index,
        field: "weekdays",
        messageKey: "pages.praemien.adminRules.validation.weekdayRequired",
      });
    }
    return issues;
  }

  if (rule.type === "dienstStartTime") {
    if (!TIME_RE.test(rule.startTimeFrom) || !TIME_RE.test(rule.startTimeTo)) {
      issues.push({
        ruleIndex: index,
        field: "startTime",
        messageKey: "pages.praemien.adminRules.validation.invalidTime",
      });
    } else if (rule.startTimeFrom > rule.startTimeTo) {
      issues.push({
        ruleIndex: index,
        field: "startTimeTo",
        messageKey: "pages.praemien.adminRules.validation.timeRangeOrder",
      });
    }
    return issues;
  }

  if (rule.type === "weekdayDienstStartTime") {
    if (!rule.weekdays.length) {
      issues.push({
        ruleIndex: index,
        field: "weekdays",
        messageKey: "pages.praemien.adminRules.validation.weekdayRequired",
      });
    }
    if (!TIME_RE.test(rule.startTimeFrom) || !TIME_RE.test(rule.startTimeTo)) {
      issues.push({
        ruleIndex: index,
        field: "startTime",
        messageKey: "pages.praemien.adminRules.validation.invalidTime",
      });
    } else if (rule.startTimeFrom > rule.startTimeTo) {
      issues.push({
        ruleIndex: index,
        field: "startTimeTo",
        messageKey: "pages.praemien.adminRules.validation.timeRangeOrder",
      });
    }
    return issues;
  }

  if (rule.type === "weekdayPickupTime") {
    if (!rule.weekdays.length) {
      issues.push({
        ruleIndex: index,
        field: "weekdays",
        messageKey: "pages.praemien.adminRules.validation.weekdayRequired",
      });
    }
    if (!TIME_RE.test(rule.pickupTimeFrom) || !TIME_RE.test(rule.pickupTimeTo)) {
      issues.push({
        ruleIndex: index,
        field: "pickupTime",
        messageKey: "pages.praemien.adminRules.validation.invalidTime",
      });
    } else if (rule.pickupTimeFrom > rule.pickupTimeTo) {
      issues.push({
        ruleIndex: index,
        field: "pickupTimeTo",
        messageKey: "pages.praemien.adminRules.validation.pickupTimeRangeOrder",
      });
    }
  }

  return issues;
}

export function validatePraemienRuleConfig(
  config: PraemienRuleConfig,
): PraemienRuleValidationIssue[] {
  const issues: PraemienRuleValidationIssue[] = [];

  if (config.rules.length < 1) {
    issues.push({
      messageKey: "pages.praemien.adminRules.validation.minRules",
    });
  }

  if (config.rules.length > MAX_PRAEMIEN_RULES) {
    issues.push({
      messageKey: "pages.praemien.adminRules.validation.maxRules",
    });
  }

  config.rules.forEach((rule, index) => {
    issues.push(...validateRule(rule, index));
  });

  return issues;
}

export function getRuleFieldIssues(
  issues: PraemienRuleValidationIssue[],
  ruleIndex: number,
  field: string,
): PraemienRuleValidationIssue[] {
  return issues.filter(
    (issue) => issue.ruleIndex === ruleIndex && issue.field === field,
  );
}
