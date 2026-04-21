import mongoose from "mongoose";
import PraemienManualDailyEntry from "../models/praemien-manual-daily-entry.model";
import type { PraemienManualDailyStatus } from "../models/praemien-manual-daily-entry.model";
import {
  assertDateAllowedForManualEntry,
  assertManualPraemienDailyApisAllowed,
} from "./assert-manual-praemien-phase.service";

const MAX_VALUE = 10_000;

export interface ManualDailyEntryDto {
  date: string;
  workerSubmittedValue: number;
  workerSubmittedAt: string;
  status: PraemienManualDailyStatus;
}

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

export async function upsertMyManualDailyEntry(params: {
  companyIdStr: string | undefined;
  userId: string;
  date: string;
  workerSubmittedValue: unknown;
  status?: unknown;
}): Promise<
  | { ok: true; entry: ManualDailyEntryDto }
  | { ok: false; statusCode: number; message: string }
> {
  const gate = await assertManualPraemienDailyApisAllowed(params.companyIdStr);
  if (!gate.allowed) {
    return { ok: false, statusCode: gate.statusCode, message: gate.message };
  }

  const dateStr = typeof params.date === "string" ? params.date.trim() : "";
  const dateCheck = assertDateAllowedForManualEntry(
    dateStr,
    gate.effectiveFrom,
  );
  if (!dateCheck.ok) {
    return { ok: false, statusCode: 400, message: dateCheck.message };
  }

  const rawVal = params.workerSubmittedValue;
  const num =
    typeof rawVal === "number"
      ? rawVal
      : typeof rawVal === "string"
        ? Number(rawVal)
        : NaN;
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0 || num > MAX_VALUE) {
    return {
      ok: false,
      statusCode: 400,
      message: `El valor debe ser un entero entre 0 y ${MAX_VALUE}.`,
    };
  }

  let status: PraemienManualDailyStatus = "submitted";
  if (params.status === "draft" || params.status === "submitted") {
    status = params.status;
  } else if (params.status != null && params.status !== "") {
    return {
      ok: false,
      statusCode: 400,
      message: "Estado inválido (use draft o submitted).",
    };
  }

  const userOid = new mongoose.Types.ObjectId(params.userId);
  const now = new Date();

  const doc = await PraemienManualDailyEntry.findOneAndUpdate(
    {
      companyId: gate.companyObjectId,
      userId: userOid,
      date: dateStr,
    },
    {
      $set: {
        workerSubmittedValue: num,
        workerSubmittedAt: now,
        status,
      },
      $setOnInsert: {
        companyId: gate.companyObjectId,
        userId: userOid,
        date: dateStr,
      },
    },
    { new: true, upsert: true, runValidators: true },
  ).lean();

  if (!doc) {
    return {
      ok: false,
      statusCode: 500,
      message: "No se pudo guardar la entrada.",
    };
  }

  return {
    ok: true,
    entry: {
      date: doc.date,
      workerSubmittedValue: doc.workerSubmittedValue,
      workerSubmittedAt: (doc.workerSubmittedAt ?? now).toISOString(),
      status: doc.status as PraemienManualDailyStatus,
    },
  };
}

export async function listMyManualDailyEntriesForMonth(params: {
  companyIdStr: string | undefined;
  userId: string;
  year: number;
  month: number;
}): Promise<
  | { ok: true; entries: ManualDailyEntryDto[] }
  | { ok: false; statusCode: number; message: string }
> {
  const gate = await assertManualPraemienDailyApisAllowed(params.companyIdStr);
  if (!gate.allowed) {
    return { ok: false, statusCode: gate.statusCode, message: gate.message };
  }

  if (
    !Number.isInteger(params.year) ||
    params.year < 1970 ||
    params.year > 2100 ||
    !Number.isInteger(params.month) ||
    params.month < 1 ||
    params.month > 12
  ) {
    return { ok: false, statusCode: 400, message: "Año o mes inválido." };
  }

  const { start, end } = monthRangeStrings(params.year, params.month);
  const userOid = new mongoose.Types.ObjectId(params.userId);

  const rows = await PraemienManualDailyEntry.find({
    companyId: gate.companyObjectId,
    userId: userOid,
    date: { $gte: start, $lte: end },
  })
    .sort({ date: 1 })
    .lean();

  const entries: ManualDailyEntryDto[] = rows.map((doc) => ({
    date: doc.date,
    workerSubmittedValue: doc.workerSubmittedValue,
    workerSubmittedAt: (doc.workerSubmittedAt ?? doc.updatedAt).toISOString(),
    status: doc.status as PraemienManualDailyStatus,
  }));

  return { ok: true, entries };
}

export async function getMyManualDailyEntryForDay(params: {
  companyIdStr: string | undefined;
  userId: string;
  date: string;
}): Promise<
  | { ok: true; entry: ManualDailyEntryDto | null }
  | { ok: false; statusCode: number; message: string }
> {
  const gate = await assertManualPraemienDailyApisAllowed(params.companyIdStr);
  if (!gate.allowed) {
    return { ok: false, statusCode: gate.statusCode, message: gate.message };
  }

  const dateStr = typeof params.date === "string" ? params.date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { ok: false, statusCode: 400, message: "Fecha inválida (use YYYY-MM-DD)." };
  }

  const userOid = new mongoose.Types.ObjectId(params.userId);

  const doc = await PraemienManualDailyEntry.findOne({
    companyId: gate.companyObjectId,
    userId: userOid,
    date: dateStr,
  }).lean();

  if (!doc) {
    return { ok: true, entry: null };
  }

  return {
    ok: true,
    entry: {
      date: doc.date,
      workerSubmittedValue: doc.workerSubmittedValue,
      workerSubmittedAt: (doc.workerSubmittedAt ?? doc.updatedAt).toISOString(),
      status: doc.status as PraemienManualDailyStatus,
    },
  };
}
