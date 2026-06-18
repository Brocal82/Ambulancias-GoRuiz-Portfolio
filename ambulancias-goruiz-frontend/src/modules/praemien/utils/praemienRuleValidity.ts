import type { PraemienRule } from "../domain/api";
import type { StatusTone } from "../../../components/common/StatusBadge";

export const PRAEMIEN_RULE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type PraemienRuleLifecycleStatus =
  | "disabled"
  | "scheduled"
  | "active"
  | "expired";

/** Local calendar day as YYYY-MM-DD (for lifecycle badges). */
export function getLocalTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isValidPraemienRuleDate(value: string): boolean {
  return PRAEMIEN_RULE_DATE_RE.test(value);
}

/** Inclusive YYYY-MM-DD window; missing bounds apply indefinitely. */
export function isPraemienRuleEffectiveOnDate(
  rule: Pick<PraemienRule, "effectiveFrom" | "effectiveTo">,
  dienstDate: string,
): boolean {
  if (rule.effectiveFrom && dienstDate < rule.effectiveFrom) return false;
  if (rule.effectiveTo && dienstDate > rule.effectiveTo) return false;
  return true;
}

export function getPraemienRuleLifecycleStatus(
  rule: PraemienRule,
  today: string = getLocalTodayIsoDate(),
): PraemienRuleLifecycleStatus {
  if (!rule.enabled) return "disabled";
  if (rule.effectiveFrom && today < rule.effectiveFrom) return "scheduled";
  if (rule.effectiveTo && today > rule.effectiveTo) return "expired";
  return "active";
}

export function getPraemienRuleLifecycleTone(
  status: PraemienRuleLifecycleStatus,
): StatusTone {
  switch (status) {
    case "disabled":
      return "slate";
    case "scheduled":
      return "amber";
    case "active":
      return "emerald";
    case "expired":
      return "rose";
  }
}
