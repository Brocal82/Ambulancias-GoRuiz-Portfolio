/**
 * Grid y botones compartidos entre la cola global de Prämies manuales y el tab por usuario.
 */

/** Detalle de un día tras elegir fecha en el calendario (trabajador o admin): anillo como la celda seleccionada. */
export const PRAEMIE_MANUAL_DAY_DETAIL_SHELL_CLASS =
  "min-w-0 w-full overflow-hidden rounded-2xl bg-white text-xs shadow-md ring-1 ring-orange-400";

export const PRAEMIE_QUEUE_COLS =
  "grid w-full min-w-0 justify-items-center [grid-template-columns:minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)] gap-x-2 gap-y-0 sm:gap-x-3";

const PRAEMIE_QUEUE_cellPad = "px-1.5 sm:px-2";

export const PRAEMIE_QUEUE_headerRow = `${PRAEMIE_QUEUE_COLS} items-center ${PRAEMIE_QUEUE_cellPad} border-b border-slate-800 bg-slate-900/95 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-200 backdrop-blur`;

export const PRAEMIE_QUEUE_bodyRow = `${PRAEMIE_QUEUE_COLS} items-center ${PRAEMIE_QUEUE_cellPad} border-b border-slate-200 bg-white py-2 last:border-0 hover:bg-slate-50/90`;

/** Detalle día (trabajador): datos + columna acciones (input + guardar / estado). */
export const PRAEMIE_WORKER_DETAIL_COLS =
  "grid w-full min-w-0 justify-items-center [grid-template-columns:minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1.65fr)] gap-x-2 gap-y-0 sm:gap-x-3";

export const PRAEMIE_WORKER_DETAIL_headerRow = `${PRAEMIE_WORKER_DETAIL_COLS} items-center ${PRAEMIE_QUEUE_cellPad} border-b border-slate-800 bg-slate-900/95 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-200 backdrop-blur`;

export const PRAEMIE_WORKER_DETAIL_bodyRow = `${PRAEMIE_WORKER_DETAIL_COLS} items-center ${PRAEMIE_QUEUE_cellPad} border-b border-slate-200 bg-white py-2 last:border-0 hover:bg-slate-50/90`;

export const PRAEMIE_QUEUE_btnApproveVacationStyle =
  "inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm text-white shadow-sm hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:opacity-50";

export const PRAEMIE_QUEUE_btnRejectVacationStyle =
  "inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm text-white shadow-sm hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-100 disabled:opacity-50";

/** Solo dígitos → 4 cifras con ceros; resto sin cambios. */
export function fmtPraemieEmployeeNoDisplay(n: string | null | undefined): string {
  if (n == null) return "—";
  const s = String(n).trim();
  if (s === "") return "—";
  if (/^\d+$/.test(s)) {
    return s.padStart(4, "0");
  }
  return s;
}
