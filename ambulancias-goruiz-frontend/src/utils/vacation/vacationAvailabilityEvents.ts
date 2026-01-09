//frontend/src/utils/vacation/vacationAvailabilityEvents.ts

export type VacationAvailabilityInvalidatedDetail = {
  year: number;
  /** month 1..12 */
  month: number;
  ts?: number;
};

const EVENT_NAME = "vacation-availability-invalidated";
const BC_NAME = "vacations";
const STORAGE_KEY = "__vac_av_inval__";

function safeParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Emite una invalidación de disponibilidad:
 * - Misma pestaña: CustomEvent
 * - Otras pestañas: BroadcastChannel (si existe)
 * - Fallback: localStorage (dispara evento 'storage' en otras pestañas)
 */
export function emitAvailabilityInvalidated(
  detail: VacationAvailabilityInvalidatedDetail,
) {
  const payload: VacationAvailabilityInvalidatedDetail = {
    ts: Date.now(),
    ...detail,
  };

  // 1) Misma pestaña
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
  } catch {
    /* noop */
  }

  // 2) Otras pestañas/ventanas: BroadcastChannel (si está disponible)
  try {
    const bc = new BroadcastChannel(BC_NAME);
    bc.postMessage({ type: "availability-invalidated", ...payload });
    bc.close?.();
  } catch {
    /* noop */
  }

  // 3) Fallback universal: localStorage -> dispara 'storage' en otras pestañas
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setTimeout(() => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* noop */
      }
    }, 500);
  } catch {
    /* noop */
  }
}

/**
 * Se suscribe a invalidaciones de disponibilidad provenientes de:
 * - CustomEvent (misma pestaña)
 * - BroadcastChannel (entre pestañas)
 * - storage event (fallback entre pestañas)
 *
 * Devuelve una función `unsubscribe()` para limpiar todo.
 */
export function subscribeAvailabilityInvalidated(
  handler: (detail: VacationAvailabilityInvalidatedDetail) => void,
) {
  // 1) CustomEvent
  const customHandler = (e: Event) => {
    const detail = (e as CustomEvent).detail as VacationAvailabilityInvalidatedDetail;
    if (!detail?.year || !detail?.month) return;
    handler(detail);
  };
  window.addEventListener(EVENT_NAME, customHandler as EventListener);

  // 2) BroadcastChannel
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(BC_NAME);
    bc.onmessage = (msg: MessageEvent) => {
      const data = msg.data || {};
      if (data?.type !== "availability-invalidated") return;
      if (!data.year || !data.month) return;
      handler({
        year: Number(data.year),
        month: Number(data.month),
        ts: data.ts ? Number(data.ts) : undefined,
      });
    };
  } catch {
    bc = null;
  }

  // 3) storage fallback
  const storageHandler = (ev: StorageEvent) => {
    if (ev.key !== STORAGE_KEY) return;
    const payload = safeParseJSON<VacationAvailabilityInvalidatedDetail>(
      ev.newValue,
    );
    if (!payload?.year || !payload?.month) return;
    handler(payload);
  };
  window.addEventListener("storage", storageHandler);

  // Unsubscribe
  return () => {
    window.removeEventListener(EVENT_NAME, customHandler as EventListener);
    window.removeEventListener("storage", storageHandler);
    try {
      bc?.close?.();
    } catch {
      /* noop */
    }
  };
}
