import type { PraemienRule } from "../types/praemien-rule-config";

/** Inclusive YYYY-MM-DD window; missing bounds apply indefinitely. */
export function isPraemienRuleEffectiveOnDate(
  rule: Pick<PraemienRule, "effectiveFrom" | "effectiveTo">,
  dienstDate: string,
): boolean {
  if (rule.effectiveFrom && dienstDate < rule.effectiveFrom) return false;
  if (rule.effectiveTo && dienstDate > rule.effectiveTo) return false;
  return true;
}
