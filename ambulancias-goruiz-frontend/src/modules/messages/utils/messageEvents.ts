/**
 * Capa de eventos para sincronización cross-tab de mensajes.
 * Patrón replicado de vacations/appointments/sick: CustomEvent + BroadcastChannel + localStorage/storage.
 */

export type MessagesChangedDetail = {
  ts?: number;
  /** dedupe: id de pestaña emisora */
  senderId?: string;
};

const EVENT_NAME = "messages-changed";
const BC_NAME = "messages";
const STORAGE_KEY = "__msgs_changed__";

const SENDER_STORAGE_KEY = "__msgs_sender_id__";
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
 * Emite "messages-changed":
 * - Misma pestaña: CustomEvent
 * - Otras pestañas: BroadcastChannel
 * - Fallback: localStorage (dispara 'storage' en otras pestañas)
 */
export function emitMessagesChanged() {
  const payload: MessagesChangedDetail = {
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
      type: "messages-changed",
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
 * Se suscribe a "messages-changed" desde:
 * - CustomEvent (misma pestaña)
 * - BroadcastChannel (entre pestañas)
 * - storage event (fallback)
 *
 * Devuelve unsubscribe() para limpiar todo.
 */
export function subscribeMessagesChanged(
  handler: (detail: MessagesChangedDetail) => void,
) {
  const shouldIgnoreSelf = (detail?: MessagesChangedDetail) => {
    if (!detail?.senderId) return false;
    return detail.senderId === THIS_SENDER_ID;
  };

  // 1) CustomEvent (misma pestaña)
  const customHandler = (e: Event) => {
    const detail = (e as CustomEvent).detail as MessagesChangedDetail;
    handler(detail);
  };
  window.addEventListener(EVENT_NAME, customHandler as EventListener);

  // 2) BroadcastChannel
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(BC_NAME);
    bc.onmessage = (msg: MessageEvent) => {
      const data = msg.data || {};
      if (data?.type !== "messages-changed") return;

      const detail: MessagesChangedDetail = {
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
    const payload = safeParseJSON<MessagesChangedDetail>(ev.newValue);
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
