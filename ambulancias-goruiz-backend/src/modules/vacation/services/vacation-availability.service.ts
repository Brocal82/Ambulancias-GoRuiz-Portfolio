import VacationRequest from "../models/vacation-request.model";
import {
  DEFAULT_MAX_PER_DAY,
  findMonthConfig,
  toMonthKey,
} from "./month-config.service";

function dayStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayEnd(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function isInRange(d: Date, start: Date, end: Date) {
  const t = d.getTime();
  return t >= dayStart(start).getTime() && t <= dayEnd(end).getTime();
}

export async function getVacationAvailability(params: {
  year: number;
  month: number;
}) {
  const { year, month } = params;

  const monthKey = toMonthKey(year, month);
  const monthStart = dayStart(new Date(year, month - 1, 1));
  const monthEnd = dayEnd(new Date(year, month, 0));
  const cfg = await findMonthConfig(monthKey);

  const maxPerDay = cfg?.maxPerDay ?? DEFAULT_MAX_PER_DAY;
  const blackouts = cfg?.blackouts ?? [];

  const requests = await VacationRequest.find({
    status: { $in: ["pending", "accepted"] },
    startDate: { $lte: monthEnd },
    endDate: { $gte: monthStart },
  })
    .select("startDate endDate status user")
    .lean();

  const daysInMonth = new Date(year, month, 0).getDate();
  const days: {
    day: number;
    approvedCount: number;
    pendingCount: number;
    remaining: number;
    state: "green" | "yellow" | "red";
  }[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const current = new Date(year, month - 1, d);

    const isBlackout = blackouts.some((r) =>
      isInRange(current, r.startDate, r.endDate),
    );
    if (isBlackout) {
      days.push({
        day: d,
        approvedCount: maxPerDay,
        pendingCount: 0,
        remaining: 0,
        state: "red",
      });
      continue;
    }

    let approvedCount = 0;
    let pendingCount = 0;

    for (const r of requests) {
      if (isInRange(current, r.startDate as Date, r.endDate as Date)) {
        if (r.status === "accepted") approvedCount += 1;
        else if (r.status === "pending") pendingCount += 1;
      }
    }

    const remaining = Math.max(0, maxPerDay - approvedCount);
    const state: "green" | "yellow" | "red" =
      approvedCount >= maxPerDay
        ? "red"
        : pendingCount > 0
          ? "yellow"
          : "green";

    days.push({ day: d, approvedCount, pendingCount, remaining, state });
  }

  return { year, month, maxPerDay, days };
}
