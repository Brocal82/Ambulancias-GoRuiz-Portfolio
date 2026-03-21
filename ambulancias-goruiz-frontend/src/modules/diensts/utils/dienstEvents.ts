/**
 * Capa de eventos para sincronización cross-tab de diensts/assignments.
 * Patrón replicado de mechanics/hospitals/workday.
 */

export type DienstsChangedDetail = {
  ts?: number;
  senderId?: string;
};

const EVENT_NAME = "diensts-changed";
const BC_NAME = "diensts-changed";
const STORAGE_KEY = "__diensts_changed__";

const SENDER_STORAGE_KEY = "__diensts_sender_id__";
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
 * Emite "diensts-changed":
 * - CustomEvent (misma pestaña)
 * - BroadcastChannel (otras pestañas)
 * - localStorage/storage (fallback)
 */
export function emitDienstsChanged() {
  const payload: DienstsChangedDetail = {
    ts: Date.now(),
    senderId: THIS_SENDER_ID,
  };

  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
  } catch {
    /* noop */
  }

  try {
    const bc = new BroadcastChannel(BC_NAME);
    bc.postMessage({
      type: "diensts-changed",
      ts: payload.ts,
      senderId: payload.senderId,
    });
    bc.close?.();
  } catch {
    /* noop */
  }

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
 * Suscripción a diensts-changed (CustomEvent + BroadcastChannel + storage).
 */
export function subscribeDienstsChanged(
  handler: (detail: DienstsChangedDetail) => void,
) {
  const shouldIgnoreSelf = (detail?: DienstsChangedDetail) => {
    if (!detail?.senderId) return false;
    return detail.senderId === THIS_SENDER_ID;
  };

  const customHandler = (e: Event) => {
    const detail = (e as CustomEvent).detail as DienstsChangedDetail;
    if (shouldIgnoreSelf(detail)) return;
    handler(detail);
  };
  window.addEventListener(EVENT_NAME, customHandler as EventListener);

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(BC_NAME);
    bc.onmessage = (msg: MessageEvent) => {
      const data = msg.data || {};
      if (data?.type !== "diensts-changed") return;
      const detail: DienstsChangedDetail = {
        ts: data.ts ? Number(data.ts) : undefined,
        senderId: typeof data.senderId === "string" ? data.senderId : undefined,
      };
      if (shouldIgnoreSelf(detail)) return;
      handler(detail);
    };
  } catch {
    bc = null;
  }

  const storageHandler = (ev: StorageEvent) => {
    if (ev.key !== STORAGE_KEY) return;
    const payload = safeParseJSON<DienstsChangedDetail>(ev.newValue);
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
