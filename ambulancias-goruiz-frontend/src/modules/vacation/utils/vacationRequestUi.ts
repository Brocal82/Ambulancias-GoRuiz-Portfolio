// frontend/src/utils/status/vacationRequestUi.ts
import type { VacationStatus } from "../domain/vacation";

// Para pills/botones de filtro (bordes + ring + hover)
export function vacationRequestFilterPillClass(
  status: VacationStatus,
  active: boolean,
) {
  const base =
    "inline-flex items-center justify-center rounded-full bg-white px-3 py-2 text-[11px] font-semibold tabular-nums shadow-sm transition border";

  if (status === "pending") {
    return [
      base,
      active
        ? "border-amber-400 text-slate-900 ring-2 ring-amber-100"
        : "border-amber-300 text-slate-700 hover:border-amber-400 hover:bg-[#FEF3C7]",
    ].join(" ");
  }

  if (status === "accepted") {
    return [
      base,
      active
        ? "border-emerald-400 text-slate-900 ring-2 ring-emerald-100"
        : "border-emerald-300 text-slate-700 hover:bg-emerald-100",
    ].join(" ");
  }

  if (status === "cancelled") {
    return [
      base,
      active
        ? "border-rose-400 text-slate-900 ring-2 ring-rose-100"
        : "border-rose-300 text-slate-700 hover:bg-rose-100",
    ].join(" ");
  }

  // option_sent
  return [
    base,
    active
      ? "border-blue-400 text-slate-900 ring-2 ring-blue-100"
      : "border-blue-300 text-slate-700 hover:bg-blue-100",
  ].join(" ");
}

