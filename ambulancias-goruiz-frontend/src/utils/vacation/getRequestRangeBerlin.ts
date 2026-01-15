// frontend/src/utils/vacation/getRequestRangeBerlin.ts
import type { IVacationRequest } from "../../types/vacationRequest";
import { dayKeyToLocalDate, toBerlinDayKey } from "../dates/dayKey";

/**
 * Devuelve un rango Date anclado a "día calendario" en Europe/Berlin:
 * - start: 00:00 local del día start
 * - end: 23:59:59.999 local del día end
 *
 * Útil para solapes por mes/año sin bugs de TZ/DST.
 */
export function getRequestRangeBerlin(req: IVacationRequest): {
  start: Date;
  end: Date;
} {
  const sKey = toBerlinDayKey(req.startDate);
  const eKey = toBerlinDayKey(req.endDate);

  // fallback defensivo si llega algo raro
  if (!sKey || !eKey) {
    return { start: new Date(req.startDate), end: new Date(req.endDate) };
  }

  const start0 = dayKeyToLocalDate(sKey);
  const end0 = dayKeyToLocalDate(eKey);

  const start = new Date(
    start0.getFullYear(),
    start0.getMonth(),
    start0.getDate(),
    0,
    0,
    0,
    0,
  );

  const end = new Date(
    end0.getFullYear(),
    end0.getMonth(),
    end0.getDate(),
    23,
    59,
    59,
    999,
  );

  return { start, end };
}
