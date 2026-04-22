/** Clave YYYY-MM-DD alineada con las celdas del calendario (corrige fechas ISO UTC). */
export function assignedDayDateKey(raw: string): string {
  const s = String(raw).trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (m) return m[1]!;
  const t = new Date(s);
  if (Number.isNaN(t.getTime())) {
    return s.length >= 10 ? s.slice(0, 10) : s;
  }
  const y = t.getFullYear();
  const mo = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

const ymScore = (y: number, m: number) => y * 12 + m;

/**
 * Hasta qué mes puede navegarse: hoy, +N meses y cualquier mes con Dienst asignado.
 */
export function maxNavigablePraemienYm(
  today: Date,
  dienstDateKeys: Iterable<string>,
  monthsAheadFallback = 12,
): { y: number; m: number } {
  const cap = new Date(today);
  cap.setMonth(cap.getMonth() + monthsAheadFallback);
  let bestY = cap.getFullYear();
  let bestM = cap.getMonth() + 1;
  const up = (y: number, m: number) => {
    if (ymScore(y, m) > ymScore(bestY, bestM)) {
      bestY = y;
      bestM = m;
    }
  };
  up(today.getFullYear(), today.getMonth() + 1);
  for (const k of dienstDateKeys) {
    const p = k.split("-");
    if (p.length < 2) continue;
    const y = Number(p[0]);
    const m = Number(p[1]);
    if (Number.isFinite(y) && Number.isFinite(m)) up(y, m);
  }
  return { y: bestY, m: bestM };
}

/**
 * Fondos suaves por número de Dienst (misma semana puede compartir tono).
 * Escala 200 + opacidad alta: legibles en calendario sin pasar a neón. Rotación por `dienstNumber`.
 */
export function dienstNumberToSoftCalendarBg(dienstNumber: number): string {
  if (!Number.isFinite(dienstNumber) || dienstNumber < 1) {
    return "bg-slate-200/95";
  }
  const palette = [
    "bg-sky-200",
    "bg-violet-200",
    "bg-teal-200",
    "bg-amber-200",
    "bg-rose-200",
    "bg-lime-200",
    "bg-indigo-200",
    "bg-fuchsia-200",
  ];
  const idx = (Math.floor(dienstNumber) - 1) % palette.length;
  return palette[idx] ?? "bg-slate-200/95";
}
