/** Evento para refrescar contador de entradas manuales pendientes de revisión (admin). */
export const PRAEMIEN_MANUAL_PENDING_CHANGED = "praemien-manual-pending-changed";

export function dispatchPraemienManualPendingChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PRAEMIEN_MANUAL_PENDING_CHANGED));
}
