import mongoose from "mongoose";
import PraemienManualDailyEntry from "../models/praemien-manual-daily-entry.model";
import type { PraemienManualDailyStatus } from "../models/praemien-manual-daily-entry.model";
import {
  assertDateAllowedForManualEntry,
  assertManualPraemienDailyApisAllowed,
} from "./assert-manual-praemien-phase.service";
import {
  mapManualDailyDocToDto,
  type ManualDailyEntryDto,
} from "./praemien-manual-daily-mapper";

export type { ManualDailyEntryDto };

const MAX_VALUE = 10_000;

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

  let statusParam: PraemienManualDailyStatus = "submitted";
  if (params.status === "draft" || params.status === "submitted") {
    statusParam = params.status;
  } else if (params.status != null && params.status !== "") {
    return {
      ok: false,
      statusCode: 400,
      message: "Estado inválido (use draft o submitted).",
    };
  }

  const userOid = new mongoose.Types.ObjectId(params.userId);
  const now = new Date();

  const existing = await PraemienManualDailyEntry.findOne({
    companyId: gate.companyObjectId,
    userId: userOid,
    date: dateStr,
  }).lean();

  if (existing && existing.status === "approved") {
    return {
      ok: false,
      statusCode: 403,
      message:
        "Esta entrada está aprobada. Pídele a un administrador que la reabra para poder editarla.",
    };
  }

  if (
    existing &&
    existing.status === "submitted" &&
    statusParam === "draft"
  ) {
    return {
      ok: false,
      statusCode: 400,
      message:
        "No se puede volver a borrador después de enviar a revisión. Pide que rechacen o reabran la entrada.",
    };
  }

  if (!existing) {
    const created = await PraemienManualDailyEntry.create({
      companyId: gate.companyObjectId,
      userId: userOid,
      date: dateStr,
      originalWorkerValue: num,
      workerSubmittedValue: num,
      workerSubmittedAt: now,
      status: statusParam,
    });
    const dto = mapManualDailyDocToDto(
      created.toObject() as unknown as Record<string, unknown>,
    );
    if (!dto) {
      return { ok: false, statusCode: 500, message: "No se pudo guardar la entrada." };
    }
    return { ok: true, entry: dto };
  }

  const patch: Record<string, unknown> = {
    workerSubmittedValue: num,
    workerSubmittedAt: now,
  };

  if (existing.originalWorkerValue == null) {
    patch.originalWorkerValue = existing.workerSubmittedValue;
  }

  let nextStatus: PraemienManualDailyStatus = statusParam;
  if (existing.status === "reopened" || existing.status === "rejected") {
    nextStatus = "submitted";
  } else {
    nextStatus = statusParam;
  }
  patch.status = nextStatus;

  await PraemienManualDailyEntry.updateOne(
    { _id: existing._id },
    { $set: patch },
  );

  const fresh = await PraemienManualDailyEntry.findById(existing._id).lean();
  const dto = mapManualDailyDocToDto(fresh as Record<string, unknown> | null);
  if (!dto) {
    return { ok: false, statusCode: 500, message: "No se pudo guardar la entrada." };
  }
  return { ok: true, entry: dto };
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

  const entries: ManualDailyEntryDto[] = rows
    .map((doc) => mapManualDailyDocToDto(doc as unknown as Record<string, unknown>))
    .filter((e): e is ManualDailyEntryDto => e != null);

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
    entry: mapManualDailyDocToDto(doc as unknown as Record<string, unknown>),
  };
}
