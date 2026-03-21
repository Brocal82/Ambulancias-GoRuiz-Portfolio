/**
 * Capa de eventos para sincronización cross-tab de workday summaries.
 * Patrón replicado de vacations/appointments/sick: CustomEvent + BroadcastChannel + localStorage/storage.
 */

export type WorkdaySummariesChangedDetail = {
  ts?: number;
  /** dedupe: id de pestaña emisora */
  senderId?: string;
};

const EVENT_NAME = "workday-summaries-changed";
const BC_NAME = "workday-summaries";
const STORAGE_KEY = "__wd_sum_changed__";

const SENDER_STORAGE_KEY = "__wd_sum_sender_id__";
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
 * Emite "workday-summaries-changed":
 * - Misma pestaña: CustomEvent
 * - Otras pestañas: BroadcastChannel
 * - Fallback: localStorage (dispara 'storage' en otras pestañas)
 */
export function emitWorkdaySummariesChanged() {
  const payload: WorkdaySummariesChangedDetail = {
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
      type: "workday-summaries-changed",
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
 * Se suscribe a "workday-summaries-changed" desde:
 * - CustomEvent (misma pestaña)
 * - BroadcastChannel (entre pestañas)
 * - storage event (fallback)
 */
export function subscribeWorkdaySummariesChanged(
  handler: (detail: WorkdaySummariesChangedDetail) => void,
) {
  const shouldIgnoreSelf = (detail?: WorkdaySummariesChangedDetail) => {
    if (!detail?.senderId) return false;
    return detail.senderId === THIS_SENDER_ID;
  };

  const customHandler = (e: Event) => {
    const detail = (e as CustomEvent).detail as WorkdaySummariesChangedDetail;
    handler(detail);
  };
  window.addEventListener(EVENT_NAME, customHandler as EventListener);

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(BC_NAME);
    bc.onmessage = (msg: MessageEvent) => {
      const data = msg.data || {};
      if (data?.type !== "workday-summaries-changed") return;
      const detail: WorkdaySummariesChangedDetail = {
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
    const payload = safeParseJSON<WorkdaySummariesChangedDetail>(ev.newValue);
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
