// frontend/src/utils/status/vacationRequestBorder.ts
import type { IVacationRequest } from "../../types/vacationRequest";

export type VacationRequestStatusKey =
  | "option_sent"
  | "pending"
  | "accepted"
  | "cancelled"
  | "none";

/**
 * Prioridad visual: option_sent > pending > accepted > cancelled > none
 * Para un rango de mes (start/end), devuelve el estado más prioritario
 * entre las requests que solapan con ese mes.
 */
export function vacationMonthBorderPriority(
  requests: IVacationRequest[],
  monthStart: Date,
  monthEnd: Date,
): VacationRequestStatusKey {
  let hasOptionSent = false;
  let hasPending = false;
  let hasAccepted = false;
  let hasCancelled = false;

  for (const r of requests) {
    const rs = new Date(r.startDate);
    const re = new Date(r.endDate);

    // overlap simple
    if (rs > monthEnd || re < monthStart) continue;

    if (r.status === "option_sent") hasOptionSent = true;
    else if (r.status === "pending") hasPending = true;
    else if (r.status === "accepted") hasAccepted = true;
    else if (r.status === "cancelled") hasCancelled = true;
  }

  if (hasOptionSent) return "option_sent";
  if (hasPending) return "pending";
  if (hasAccepted) return "accepted";
  if (hasCancelled) return "cancelled";
  return "none";
}

export function vacationRequestBorderClass(status: VacationRequestStatusKey) {
  if (status === "option_sent") return "border-sky-300 ring-2 ring-sky-100";
  if (status === "pending") return "border-amber-300 ring-2 ring-amber-100";
  if (status === "accepted") return "border-emerald-300 ring-2 ring-emerald-100";
  if (status === "cancelled") return "border-rose-300 ring-2 ring-rose-100";
  return "border-slate-200";
}
