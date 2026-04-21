/**
 * Superadmin company edit: when to attach `praemienModeEffectiveFrom` (first day
 * of the next calendar month after save). Keeps a single pending transition and
 * lets the last save win if the admin revisits the mode before that month.
 */
export function getNextCalendarMonth(now: Date = new Date()): {
  year: number;
  month: number;
} {
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { year: next.getFullYear(), month: next.getMonth() + 1 };
}

export function shouldAttachPraemienEffectiveFromOnCompanyEdit(params: {
  initialPraemienMode: "automatic" | "manual" | null;
  praemienMode: "automatic" | "manual";
  /** True after any Prämien mode radio change in this edit session. */
  praemienScheduleTouched: boolean;
}): boolean {
  const { initialPraemienMode, praemienMode, praemienScheduleTouched } = params;
  if (initialPraemienMode === null) return false;
  return (
    praemienMode !== initialPraemienMode ||
    (praemienScheduleTouched && praemienMode === "manual")
  );
}
