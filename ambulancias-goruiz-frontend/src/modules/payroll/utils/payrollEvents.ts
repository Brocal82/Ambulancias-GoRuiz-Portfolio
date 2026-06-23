/**
 * Cross-tab event layer for payroll realtime sync.
 * Pattern mirrors documentsEvents: CustomEvent + BroadcastChannel + localStorage fallback.
 */

const EVENT_NAME = "payroll-changed";
const BC_NAME = "payroll";
const STORAGE_KEY = "__payroll_changed__";

export function emitPayrollChanged(): void {
  const payload = { ts: Date.now() };

  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
  } catch {
    /* noop */
  }

  try {
    const bc = new BroadcastChannel(BC_NAME);
    bc.postMessage({ type: EVENT_NAME, ...payload });
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

export function subscribePayrollChanged(handler: () => void): () => void {
  const customHandler = () => handler();
  window.addEventListener(EVENT_NAME, customHandler as EventListener);

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(BC_NAME);
    bc.onmessage = (msg: MessageEvent) => {
      if ((msg.data as { type?: string })?.type === EVENT_NAME) handler();
    };
  } catch {
    bc = null;
  }

  const storageHandler = (ev: StorageEvent) => {
    if (ev.key === STORAGE_KEY && ev.newValue) handler();
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
