//frontend/src/utils/vacation/vacationAvailabilityEvents.ts

export type VacationAvailabilityInvalidatedDetail = {
  year: number;
  /** month 1..12 */
  month: number;
  ts?: number;

  /** ✅ dedupe: id de pestaña emisora */
  senderId?: string;
};

const EVENT_NAME = "vacation-availability-invalidated";
const BC_NAME = "vacations";
const STORAGE_KEY = "__vac_av_inval__";

// ✅ id estable por pestaña (sessionStorage)
const SENDER_STORAGE_KEY = "__vac_sender_id__";
function getSenderId(): string {
  try {
    const existing = sessionStorage.getItem(SENDER_STORAGE_KEY);
    if (existing) return existing;

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    sessionStorage.setItem(SENDER_STORAGE_KEY, id);
    return id;
  } catch {
    // si sessionStorage falla, seguimos sin romper
    return "unknown";
  }
}

const THIS_SENDER_ID = getSenderId();

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
    senderId: THIS_SENDER_ID,
    ...detail,
  };

  // 1) Misma pestaña
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
  } catch {
    /* noop */
  }

  // 2) Otras pestañas/ventanas: BroadcastChannel
  // (⚠️ la misma pestaña también lo puede recibir, pero lo deduplicamos por senderId)
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
  const shouldIgnoreSelf = (detail?: VacationAvailabilityInvalidatedDetail) => {
    if (!detail?.senderId) return false;
    return detail.senderId === THIS_SENDER_ID;
  };

  // 1) CustomEvent (misma pestaña) -> ✅ SI lo procesamos
  const customHandler = (e: Event) => {
    const detail = (e as CustomEvent).detail as VacationAvailabilityInvalidatedDetail;
    if (!detail?.year || !detail?.month) return;

    // CustomEvent siempre será de la misma pestaña => NO lo ignoramos
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

      const detail: VacationAvailabilityInvalidatedDetail = {
        year: Number(data.year),
        month: Number(data.month),
        ts: data.ts ? Number(data.ts) : undefined,
        senderId: typeof data.senderId === "string" ? data.senderId : undefined,
      };

      // ✅ dedupe: si viene de esta misma pestaña, ignorar
      if (shouldIgnoreSelf(detail)) return;

      handler(detail);
    };
  } catch {
    bc = null;
  }

  // 3) storage fallback
  const storageHandler = (ev: StorageEvent) => {
    if (ev.key !== STORAGE_KEY) return;
    const payload = safeParseJSON<VacationAvailabilityInvalidatedDetail>(ev.newValue);
    if (!payload?.year || !payload?.month) return;

    // ✅ dedupe: si viene de esta misma pestaña, ignorar
    if (shouldIgnoreSelf(payload)) return;

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
