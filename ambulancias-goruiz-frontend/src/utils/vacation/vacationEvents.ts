// frontend/src/utils/vacation/vacationEvents.ts

export type VacationRequestsUpdatedPayload = {
  id: string;
  status: "accepted" | "cancelled" | "deleted";
  ts?: number;
};

export type VacationAvailabilityInvalidatedPayload = {
  year: number;
  month: number; // 1..12
  ts?: number;
};

const CHANNEL_NAME = "vacations";
const STORAGE_REQ_KEY = "__vac_req_upd__";
const STORAGE_AV_KEY = "__vac_av_inval__";

/**
 * Emite un evento para que otras partes (misma pestaña / otras pestañas) sepan
 * que la lista de solicitudes del worker debe refrescarse.
 */
export function emitVacationRequestsUpdated(
  payload: VacationRequestsUpdatedPayload,
) {
  const detail = { ts: Date.now(), ...payload };

  // 1) Misma pestaña
  try {
    window.dispatchEvent(
      new CustomEvent("vacation-requests-updated", { detail }),
    );
  } catch {
    /* noop */
  }

  // 2) Entre pestañas: BroadcastChannel
  try {
    const bc = new BroadcastChannel(CHANNEL_NAME);
    bc.postMessage({ type: "requests-updated", ...detail });
    bc.close?.();
  } catch {
    /* noop */
  }

  // 3) Fallback universal: localStorage (dispara evento storage)
  try {
    localStorage.setItem(STORAGE_REQ_KEY, JSON.stringify(detail));
    setTimeout(() => {
      try {
        localStorage.removeItem(STORAGE_REQ_KEY);
      } catch {
        /* noop */
      }
    }, 500);
  } catch {
    /* noop */
  }
}

/**
 * Emite invalidación de disponibilidad mensual.
 * Esto fuerza a recalcular/recargar el mini calendario y el grid del admin,
 * y el calendario del worker si está abierto.
 */
export function emitVacationAvailabilityInvalidated(
  payload: VacationAvailabilityInvalidatedPayload,
) {
  const detail = { ts: Date.now(), ...payload };

  // 1) Misma pestaña
  try {
    window.dispatchEvent(
      new CustomEvent("vacation-availability-invalidated", { detail }),
    );
  } catch {
    /* noop */
  }

  // 2) Entre pestañas
  try {
    const bc = new BroadcastChannel(CHANNEL_NAME);
    bc.postMessage({ type: "availability-invalidated", ...detail });
    bc.close?.();
  } catch {
    /* noop */
  }

  // 3) Fallback storage
  try {
    localStorage.setItem(STORAGE_AV_KEY, JSON.stringify(detail));
    setTimeout(() => {
      try {
        localStorage.removeItem(STORAGE_AV_KEY);
      } catch {
        /* noop */
      }
    }, 500);
  } catch {
    /* noop */
  }
}
