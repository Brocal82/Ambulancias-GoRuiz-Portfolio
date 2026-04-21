export type PraemienModeEffectiveFrom = { year: number; month: number };

/**
 * Whether workday review UIs should show prämie multipliers / totals and run
 * frontend calculateEffectivePatients. Backend persistence is unchanged.
 *
 * Call with `praemienEnabled` from `useModules().hasModule(MODULE_KEYS.PRAEMIEN)`.
 *
 * - Module off: never active.
 * - automatic (or unknown mode with module on): active (ignores
 *   `praemienModeEffectiveFrom`; deferred automatic-from-manual is not split
 *   into a separate behavioral mode in V1 — only superadmin scheduling + APIs
 *   use that field when stored mode is automatic).
 * - manual: active only before the first day of `praemienModeEffectiveFrom`
 *   (transition month still uses automatic-style UI). Missing effectiveFrom
 *   with manual → not active (safe default).
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
