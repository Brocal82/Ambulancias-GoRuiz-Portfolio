import type { PraemienModeEffectiveFrom } from "../../companies/domain/types";

/**
 * Phase 3: manual daily-entry APIs and UI are active when the company is in
 * effective manual mode — i.e. stored `praemienMode === "manual"` and today
 * is on or after the first day of `praemienModeEffectiveFrom`.
 * Before that date, workers still follow automatic summaries (product rule).
 */
export function isPraemienManualEntryPhaseActive(params: {
  praemienEnabled: boolean;
  praemienMode: "automatic" | "manual" | null | undefined;
  praemienModeEffectiveFrom: PraemienModeEffectiveFrom | null | undefined;
  now?: Date;
}): boolean {
  const { praemienEnabled, praemienMode, praemienModeEffectiveFrom, now = new Date() } =
    params;

  if (!praemienEnabled) return false;
  if (praemienMode !== "manual") return false;

  const from = praemienModeEffectiveFrom;
  if (
    !from ||
    typeof from.year !== "number" ||
    typeof from.month !== "number" ||
    from.month < 1 ||
    from.month > 12
  ) {
    return false;
  }

  const effectiveStart = new Date(from.year, from.month - 1, 1);
  effectiveStart.setHours(0, 0, 0, 0);
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  return todayStart >= effectiveStart;
}

export function formatPraemienEffectiveMonthLabel(
  from: PraemienModeEffectiveFrom | null | undefined,
  locale: string,
): string {
  if (!from || typeof from.month !== "number" || typeof from.year !== "number") {
    return "";
  }
  try {
    return new Date(from.year, from.month - 1, 1).toLocaleString(locale, {
      month: "long",
      year: "numeric",
    });
  } catch {
    return `${from.month}/${from.year}`;
  }
}
