/** Devuelve 'YYYY-MM-DD' y 'HH:mm' de un ISO, en la TZ dada */
export function partsFromISO(
  iso?: string,
  timeZone: string = "UTC",
): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);

  const dateParts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (parts: Intl.DateTimeFormatPart[], type: string, def = "00") =>
    parts.find((p) => p.type === type)?.value ?? def;

  return {
    date: `${get(dateParts, "year", "0000")}-${get(dateParts, "month", "01")}-${get(dateParts, "day", "01")}`,
    time: `${get(timeParts, "hour")}:${get(timeParts, "minute")}`,
  };
}

/** Calcula el offset (minutos) de una zona IANA en un instante dado */
export function getTimeZoneOffsetMinutes(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const v: Record<string, string> = {};
  for (const p of parts) v[p.type] = p.value;

  // “asUTC” es el timestamp si interpretamos ese reloj de la zona como UTC
  const asUTC = Date.UTC(
    Number(v.year),
    Number(v.month) - 1,
    Number(v.day),
    Number(v.hour),
    Number(v.minute),
    Number(v.second),
  );
  return (asUTC - date.getTime()) / 60000; // minutos
}

/** Interpreta YYYY-MM-DD + HH:mm como hora en `timeZone` y devuelve UTC ISO (+ end por duración) */
export function localDateTimeToUtcISO(
  timeZone: string,
  dateStr: string,
  timeStr: string,
  minutes: number,
): { startISO: string; endISO: string; start: Date; end: Date } | null {
  if (!dateStr || !timeStr || !minutes) return null;

  const [y, m, d] = dateStr.split("-").map(Number);
  const [H, M] = timeStr.split(":").map(Number);

  // Base UTC a partir de componentes (no aplica offset aún)
  const baseUTC = new Date(Date.UTC(y, m - 1, d, H, M, 0, 0));

  // Offset real de la zona (maneja DST)
  const offsetMin = getTimeZoneOffsetMinutes(timeZone, baseUTC);

  // Instante UTC correcto que corresponde a ese reloj local
  const start = new Date(baseUTC.getTime() - offsetMin * 60 * 1000);
  const end = new Date(start.getTime() + minutes * 60 * 1000);

  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    start,
    end,
  };
}
