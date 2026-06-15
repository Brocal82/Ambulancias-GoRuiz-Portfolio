export type PraemienModeEffectiveFrom = { year: number; month: number };

/**
 * Whether workday review UIs should show prämie multipliers / totals.
 * Mirrors ambulancias-goruiz-frontend/src/modules/workday/utils/isPraemienWorkdayUiActive.ts
 */
export function isPraemienWorkdayUiActive(params: {
  praemienEnabled: boolean;
  praemienMode: "automatic" | "manual" | null | undefined;
  praemienModeEffectiveFrom: PraemienModeEffectiveFrom | null | undefined;
  now?: Date;
}): boolean {
  const { praemienEnabled, praemienMode, praemienModeEffectiveFrom, now = new Date() } =
    params;

  if (!praemienEnabled) return false;

  const mode = praemienMode ?? "automatic";

  if (mode === "manual") {
    if (
      !praemienModeEffectiveFrom ||
      typeof praemienModeEffectiveFrom.year !== "number" ||
      typeof praemienModeEffectiveFrom.month !== "number"
    ) {
      return false;
    }
    const eff = new Date(
      praemienModeEffectiveFrom.year,
      praemienModeEffectiveFrom.month - 1,
      1,
    );
    eff.setHours(0, 0, 0, 0);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return today < eff;
  }

  return true;
}
