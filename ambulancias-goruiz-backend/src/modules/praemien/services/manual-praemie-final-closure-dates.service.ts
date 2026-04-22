import mongoose from "mongoose";
import WorkdaySummary from "../../workday-summary/models/workday-summary.model";

function monthRangeStrings(year: number, month1to12: number): {
  start: string;
  end: string;
} {
  const start = new Date(year, month1to12 - 1, 1);
  const end = new Date(year, month1to12, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const startStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  const endStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
  return { start: startStr, end: endStr };
}

/**
 * Días (YYYY-MM-DD) del mes en que el usuario figura en un resumen con cierre
 * final de jornada (Dienst) — conductor o medic.
 */
export async function listUserFinalWorkdayClosureDatesInMonth(params: {
  companyObjectId: mongoose.Types.ObjectId;
  userId: string;
  year: number;
  month: number;
}): Promise<string[]> {
  const { start, end } = monthRangeStrings(params.year, params.month);
  const userOid = new mongoose.Types.ObjectId(params.userId);
  const co = params.companyObjectId;

  const rows = await WorkdaySummary.find({
    $and: [
      { date: { $gte: start, $lte: end } },
      { isFinalClosure: true },
      { $or: [{ driver: userOid }, { medic: userOid }] },
      {
        $or: [{ companyId: co }, { companyId: null }],
      },
    ],
  })
    .select("date")
    .lean();

  const out = new Set<string>();
  for (const r of rows) {
    if (r.date) out.add(String(r.date));
  }
  return Array.from(out).sort();
}

/**
 * Comprueba si el usuario participó en un cierre final ese día.
 */
export async function userHasFinalWorkdayClosureOnDate(params: {
  companyObjectId: mongoose.Types.ObjectId;
  userId: string;
  dateStr: string;
}): Promise<boolean> {
  const userOid = new mongoose.Types.ObjectId(params.userId);
  const co = params.companyObjectId;
  const found = await WorkdaySummary.findOne({
    $and: [
      { date: params.dateStr },
      { isFinalClosure: true },
      { $or: [{ driver: userOid }, { medic: userOid }] },
      {
        $or: [{ companyId: co }, { companyId: null }],
      },
    ],
  })
    .select("_id")
    .lean();

  return found != null;
}
