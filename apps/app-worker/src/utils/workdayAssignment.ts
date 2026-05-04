import type { AssignedDay } from "../services/workday";

export function canStartTripNow(startTime: string | undefined, dienstDate: string): boolean {
  if (!startTime) return false;
  const [sh, sm] = startTime.split(":").map(Number);
  if (Number.isNaN(sh) || Number.isNaN(sm)) return false;
  const start = new Date(`${dienstDate}T00:00:00`);
  start.setHours(sh, sm - 30, 0, 0);
  return Date.now() >= start.getTime();
}

function crossesMidnight(start: string, end: string): boolean {
  const [sh] = start.split(":").map(Number);
  const [eh] = end.split(":").map(Number);
  return eh < sh;
}

function isNowWithinDienst(dienst: Pick<AssignedDay, "date" | "startTime" | "endTime">): boolean {
  const d = dienst.date;
  const st = dienst.startTime ?? "00:00";
  const et = dienst.endTime ?? "23:59";
  const now = new Date();
  const [sH, sM] = st.split(":").map(Number);
  const [eH, eM] = et.split(":").map(Number);
  const start = new Date(`${d}T00:00:00`);
  start.setHours(sH, sM, 0, 0);
  const end = new Date(`${d}T00:00:00`);
  end.setHours(eH, eM, 0, 0);
  if (crossesMidnight(st, et)) {
    end.setDate(end.getDate() + 1);
  }
  return now >= start && now <= end;
}

function toDateKey(input?: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const direct = /^(\d{4}-\d{2}-\d{2})$/.exec(trimmed);
  if (direct) return direct[1] ?? null;
  const iso = /^(\d{4}-\d{2}-\d{2})T/.exec(trimmed);
  if (iso) return iso[1] ?? null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function resolveTodayAssignment(days: AssignedDay[]): AssignedDay | null {
  const today = todayDateKey();
  const direct = days.find((item) => toDateKey(item.date) === today) ?? null;
  if (direct) return direct;

  const yesterday = new Date(Date.now() - 86_400_000);
  const y = yesterday.getFullYear();
  const m = String(yesterday.getMonth() + 1).padStart(2, "0");
  const d = String(yesterday.getDate()).padStart(2, "0");
  const yesterdayKey = `${y}-${m}-${d}`;
  const yest = days.find((item) => toDateKey(item.date) === yesterdayKey);
  if (
    yest &&
    yest.startTime &&
    yest.endTime &&
    crossesMidnight(yest.startTime, yest.endTime) &&
    isNowWithinDienst(yest as AssignedDay)
  ) {
    return yest;
  }
  return null;
}
