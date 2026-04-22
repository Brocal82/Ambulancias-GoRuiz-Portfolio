/**
 * YYYY-MM-DD en calendario local (no UTC). Evita desplazamientos de día al
 * consultar WorkdaySummary y rangos mensuales con `toISOString()`.
 */
export function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
