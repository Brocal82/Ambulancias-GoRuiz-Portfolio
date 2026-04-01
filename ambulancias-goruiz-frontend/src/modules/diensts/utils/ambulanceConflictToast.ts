import { toastT } from "../../../utils/toast";
import type { Msg } from "../../../utils/toast";
import { formatISOToDDMMYYYY } from "../../../utils/timeUtils";

export type AmbulanceTimeConflictDetail = {
  dienstNumber: number;
  date: string;
  conflictingStart: string;
  conflictingEnd: string;
  incomingStart: string;
  incomingEnd: string;
};

function parseAmbulanceTimeConflictFirst(
  details: unknown,
): AmbulanceTimeConflictDetail | null {
  if (!Array.isArray(details) || details.length === 0) return null;
  const c = details[0] as Record<string, unknown>;
  const dienstNumber = c?.dienstNumber;
  if (typeof dienstNumber !== "number") return null;
  const date = c?.date;
  const conflictingStart = c?.conflictingStart;
  const conflictingEnd = c?.conflictingEnd;
  const incomingStart = c?.incomingStart;
  const incomingEnd = c?.incomingEnd;
  if (
    typeof date !== "string" ||
    typeof conflictingStart !== "string" ||
    typeof conflictingEnd !== "string" ||
    typeof incomingStart !== "string" ||
    typeof incomingEnd !== "string"
  ) {
    return null;
  }
  return {
    dienstNumber,
    date,
    conflictingStart,
    conflictingEnd,
    incomingStart,
    incomingEnd,
  };
}

function formatConflictDate(dateISO: string): string {
  return formatISOToDDMMYYYY(`${dateISO}T12:00:00`);
}

/**
 * Si la API devuelve `ambulance_time_conflict` con `details` estructurados,
 * muestra el mensaje localizado; si no, delega en el mismo comportamiento que `toastT.apiError`.
 */
export function toastAmbulanceConflictOrApiError(
  err: unknown,
  fallback: Msg,
): void {
  const ax = err as {
    response?: { data?: { code?: string; details?: unknown } };
  };
  const code = ax?.response?.data?.code;
  const details = ax?.response?.data?.details;

  if (code === "ambulance_time_conflict") {
    const c = parseAmbulanceTimeConflictFirst(details);
    if (c) {
      toastT.error([
        "toasts.assignments.ambulanceTimeConflict",
        {
          dienstNumber: c.dienstNumber,
          date: formatConflictDate(c.date),
          conflictingStart: c.conflictingStart,
          conflictingEnd: c.conflictingEnd,
          incomingStart: c.incomingStart,
          incomingEnd: c.incomingEnd,
        },
      ]);
      return;
    }
  }
  toastT.apiError(err, fallback);
}
