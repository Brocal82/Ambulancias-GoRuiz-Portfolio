// frontend/src/utils/vacation/vacationRequestEvents.ts

export type VacationRequestEventType = "created" | "updated" | "deleted";

export type VacationRequestsUpdatedDetail = {
  type: VacationRequestEventType;
  id: string; // obligatorio
  status?: "pending" | "accepted" | "cancelled" | "option_sent";
  ts?: number;

  /** ✅ dedupe: id de pestaña emisora */
  senderId?: string;
};

const EVENT_NAME = "vacation-requests-updated";
const BC_NAME = "vacations";
const STORAGE_KEY = "__vac_req_upd__";

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
 * Emite un “requests-updated”:
 * - Misma pestaña: CustomEvent
 * - Otras pestañas: BroadcastChannel (si existe)
 * - Fallback: localStorage (dispara 'storage' en otras pestañas)
 */
export function emitVacationRequestsUpdated(
  detail: VacationRequestsUpdatedDetail,
) {
  const payload: VacationRequestsUpdatedDetail = {
    ...detail,
    ts: Date.now(),
    senderId: THIS_SENDER_ID,
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
    bc.postMessage({
      type: "requests-updated", // canal
      eventType: payload.type, // evento real
      id: payload.id,
      status: payload.status,
      ts: payload.ts,
      senderId: payload.senderId,
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
  const shouldIgnoreSelf = (detail?: VacationRequestsUpdatedDetail) => {
    if (!detail?.senderId) return false;
    return detail.senderId === THIS_SENDER_ID;
  };

  // 1) CustomEvent (misma pestaña) -> ✅ SI lo procesamos
  const customHandler = (e: Event) => {
    const detail = (e as CustomEvent).detail as VacationRequestsUpdatedDetail;
    if (!detail?.type) return;
    if (!detail?.id) return;
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
      if (!data.eventType) return;
      if (!data.id) return;

      const detail: VacationRequestsUpdatedDetail = {
        type: String(data.eventType) as VacationRequestEventType,
        id: String(data.id),
        status: data.status as VacationRequestsUpdatedDetail["status"],
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
    const payload = safeParseJSON<VacationRequestsUpdatedDetail>(ev.newValue);
    if (!payload?.type) return;
    if (!payload?.id) return;

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
