/**
 * Capa de eventos para sincronización cross-tab de sick leaves.
 * Patrón replicado de vacations/appointments: CustomEvent + BroadcastChannel + localStorage/storage.
 */

export type SickLeavesChangedDetail = {
  ts?: number;
  /** dedupe: id de pestaña emisora */
  senderId?: string;
};

const EVENT_NAME = "sick-leaves-changed";
const BC_NAME = "sick-leaves";
const STORAGE_KEY = "__sick_changed__";

const SENDER_STORAGE_KEY = "__sick_sender_id__";
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
 * Emite "sick-leaves-changed":
 * - Misma pestaña: CustomEvent
 * - Otras pestañas: BroadcastChannel
 * - Fallback: localStorage (dispara 'storage' en otras pestañas)
 */
export function emitSickLeavesChanged() {
  const payload: SickLeavesChangedDetail = {
    ts: Date.now(),
    senderId: THIS_SENDER_ID,
  };

  // 1) Misma pestaña
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
  } catch {
    /* noop */
  }

  // 2) Otras pestañas: BroadcastChannel
  try {
    const bc = new BroadcastChannel(BC_NAME);
    bc.postMessage({
      type: "sick-leaves-changed",
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
 * Se suscribe a "sick-leaves-changed" desde:
 * - CustomEvent (misma pestaña)
 * - BroadcastChannel (entre pestañas)
 * - storage event (fallback)
 *
 * Devuelve unsubscribe() para limpiar todo.
 */
export function subscribeSickLeavesChanged(
  handler: (detail: SickLeavesChangedDetail) => void,
) {
  const shouldIgnoreSelf = (detail?: SickLeavesChangedDetail) => {
    if (!detail?.senderId) return false;
    return detail.senderId === THIS_SENDER_ID;
  };

  // 1) CustomEvent (misma pestaña)
  const customHandler = (e: Event) => {
    const detail = (e as CustomEvent).detail as SickLeavesChangedDetail;
    handler(detail);
  };
  window.addEventListener(EVENT_NAME, customHandler as EventListener);

  // 2) BroadcastChannel
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(BC_NAME);
    bc.onmessage = (msg: MessageEvent) => {
      const data = msg.data || {};
      if (data?.type !== "sick-leaves-changed") return;

      const detail: SickLeavesChangedDetail = {
        ts: data.ts ? Number(data.ts) : undefined,
        senderId: typeof data.senderId === "string" ? data.senderId : undefined,
      };

      if (shouldIgnoreSelf(detail)) return;
      handler(detail);
    };
  } catch {
    bc = null;
  }

  // 3) storage fallback
  const storageHandler = (ev: StorageEvent) => {
    if (ev.key !== STORAGE_KEY) return;
    const payload = safeParseJSON<SickLeavesChangedDetail>(ev.newValue);
    if (!payload) return;

    if (shouldIgnoreSelf(payload)) return;
    handler(payload);
  };
  window.addEventListener("storage", storageHandler);

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
