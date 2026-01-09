// frontend/src/utils/vacation/vacationRequestEvents.ts

export type VacationRequestEventType = "created" | "updated" | "deleted";

export type VacationRequestsUpdatedDetail = {
  type: VacationRequestEventType;
  id?: string; // opcional: en "created" podría no venir
  status?: "pending" | "accepted" | "cancelled" | "option_sent";
  ts?: number;
};



const EVENT_NAME = "vacation-requests-updated";
const BC_NAME = "vacations";
const STORAGE_KEY = "__vac_req_upd__";

function safeParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Emite un “requests-updated”:
 * - Misma pestaña: CustomEvent
 * - Otras pestañas: BroadcastChannel (si existe)
 * - Fallback: localStorage (dispara 'storage' en otras pestañas)
 */
export function emitVacationRequestsUpdated(detail: VacationRequestsUpdatedDetail) {
const payload: VacationRequestsUpdatedDetail = {
  ...detail,
  ts: Date.now(),
};

  // 1) Misma pestaña
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
  } catch {
    /* noop */
  }

  // 2) Otras pestañas/ventanas: BroadcastChannel
  try {
    const bc = new BroadcastChannel(BC_NAME);
    bc.postMessage({
  type: "requests-updated", // canal
  eventType: payload.type,  // evento real
  id: payload.id,
  status: payload.status,
  ts: payload.ts,
});

    bc.close?.();
  } catch {
    /* noop */
  }

  // 3) Fallback: localStorage
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
 * Se suscribe a “requests-updated” desde:
 * - CustomEvent (misma pestaña)
 * - BroadcastChannel (entre pestañas)
 * - storage event (fallback)
 *
 * Devuelve `unsubscribe()` para limpiar todo.
 */
export function subscribeVacationRequestsUpdated(
  handler: (detail: VacationRequestsUpdatedDetail) => void,
) {
  // 1) CustomEvent
  const customHandler = (e: Event) => {
    const detail = (e as CustomEvent).detail as VacationRequestsUpdatedDetail;
    if (!detail?.id || !detail?.status) return;
    handler(detail);
  };
  window.addEventListener(EVENT_NAME, customHandler as EventListener);

  // 2) BroadcastChannel
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(BC_NAME);
    bc.onmessage = (msg: MessageEvent) => {
  const data = msg.data || {};
  if (data?.type !== "requests-updated") return;

  const detail: VacationRequestsUpdatedDetail = {
    type: data.eventType, // 👈 nuevo
    id: data.id ? String(data.id) : undefined,
    status: data.status,
    ts: data.ts ? Number(data.ts) : undefined,
  };

  if (!detail.type) return;
  handler(detail);
};

  } catch {
    bc = null;
  }

  // 3) storage fallback
  const storageHandler = (ev: StorageEvent) => {
    if (ev.key !== STORAGE_KEY) return;
    const payload = safeParseJSON<VacationRequestsUpdatedDetail>(ev.newValue);
    if (!payload?.id || !payload?.status) return;
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
