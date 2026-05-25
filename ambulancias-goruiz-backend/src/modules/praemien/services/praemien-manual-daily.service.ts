import mongoose from "mongoose";
import PraemienManualDailyEntry from "../models/praemien-manual-daily-entry.model";
import type { PraemienManualDailyStatus } from "../models/praemien-manual-daily-entry.model";
import WorkdaySummary from "../../workday-summary/models/workday-summary.model";
import {
  assertDateAllowedForManualEntry,
  assertManualPraemienDailyApisAllowed,
} from "./assert-manual-praemien-phase.service";
import {
  listUserFinalWorkdayClosureDatesInMonth,
  userHasFinalWorkdayClosureOnDate,
} from "./manual-praemie-final-closure-dates.service";
import { enrichManualDailyDto, enrichManualDailyDtosWithAdminNames } from "./enrich-manual-daily-dto-admin-names";
import { parseManualPraemieNumericValue } from "./manual-praemie-value-parse";
import {
  mapManualDailyDocToDto,
  toWorkerFacingManualDailyDto,
  type ManualDailyEntryDto,
} from "./praemien-manual-daily-mapper";
import { syncDienstPartnersManualDailySubmitted } from "./manual-daily-dienst-teammates";
import { legacyAwareWorkdayCompanyFilter } from "../utils/legacyWorkdayCompanyFilter";
import { isValidPraemienYearMonth } from "../utils/parsePraemienYearMonth";

export type { ManualDailyEntryDto };


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

function listDateKeysInRange(start: Date, end: Date): string[] {
  const out: string[] = [];
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  const max = new Date(end);
  max.setHours(0, 0, 0, 0);
  while (d <= max) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

async function sumPartialTripsForUserOnDate(params: {
  companyObjectId: mongoose.Types.ObjectId;
  userId: string;
  dateStr: string;
}): Promise<number> {
  const userOid = new mongoose.Types.ObjectId(params.userId);
  const rows = await WorkdaySummary.find({
    $and: [
      { date: params.dateStr },
      { isFinalClosure: false },
      { $or: [{ driver: userOid }, { medic: userOid }] },
      legacyAwareWorkdayCompanyFilter(params.companyObjectId),
    ],
  })
    .select("totalEffectivePatients")
    .lean();
  return rows.reduce((acc, row) => {
    const value =
      typeof row.totalEffectivePatients === "number" &&
      Number.isFinite(row.totalEffectivePatients)
        ? row.totalEffectivePatients
        : 0;
    return acc + value;
  }, 0);
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

  if (gate.workdayEnabled) {
    const hasFinalClosure = await userHasFinalWorkdayClosureOnDate({
      companyObjectId: gate.companyObjectId,
      userId: params.userId,
      dateStr,
    });
    if (!hasFinalClosure) {
      return {
        ok: false,
        statusCode: 400,
        message:
          "Solo puedes registrar la Prämie manual en días en los que cerraste la jornada con un cierre total (día con Dienst finalizado).",
      };
    }
  }

  const valueParsed = parseManualPraemieNumericValue(params.workerSubmittedValue);
  if (!valueParsed.ok) {
    return { ok: false, statusCode: 400, message: valueParsed.message };
  }
  const num = valueParsed.value;
  const partialTripsBonus = gate.workdayEnabled
    ? await sumPartialTripsForUserOnDate({
        companyObjectId: gate.companyObjectId,
        userId: params.userId,
        dateStr,
      })
    : 0;
  const submittedTotal = num + partialTripsBonus;

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

  if (existing && existing.status === "reopened") {
    return {
      ok: false,
      statusCode: 403,
      message:
        "Un administrador está corrigiendo esta entrada. No puedes editarla desde tu cuenta.",
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
      originalWorkerValue: submittedTotal,
      workerSubmittedValue: submittedTotal,
      workerSubmittedAt: now,
      status: statusParam,
    });
    const dto = mapManualDailyDocToDto(
      created.toObject() as unknown as Record<string, unknown>,
    );
    if (!dto) {
      return { ok: false, statusCode: 500, message: "No se pudo guardar la entrada." };
    }
    if (statusParam === "submitted") {
      await syncDienstPartnersManualDailySubmitted({
        companyObjectId: gate.companyObjectId,
        primaryUserId: params.userId,
        dateStr,
        submittedValue: submittedTotal,
      });
    }
    return {
      ok: true,
      entry: toWorkerFacingManualDailyDto(await enrichManualDailyDto(dto)),
    };
  }

  const patch: Record<string, unknown> = {
    workerSubmittedValue: submittedTotal,
    workerSubmittedAt: now,
  };

  if (existing.originalWorkerValue == null) {
    patch.originalWorkerValue = existing.workerSubmittedValue;
  }

  let nextStatus: PraemienManualDailyStatus = statusParam;
  if (existing.status === "rejected") {
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
  if (nextStatus === "submitted") {
    await syncDienstPartnersManualDailySubmitted({
      companyObjectId: gate.companyObjectId,
      primaryUserId: params.userId,
      dateStr,
      submittedValue: submittedTotal,
    });
  }
  return {
    ok: true,
    entry: toWorkerFacingManualDailyDto(await enrichManualDailyDto(dto)),
  };
}

export async function listMyManualDailyEntriesForMonth(params: {
  companyIdStr: string | undefined;
  userId: string;
  year: number;
  month: number;
  /** Solo rutas trabajador: oculta `reopened` como `approved`. Admin debe usar false. */
  applyWorkerFacing?: boolean;
}): Promise<
  | { ok: true; entries: ManualDailyEntryDto[] }
  | { ok: false; statusCode: number; message: string }
> {
  const gate = await assertManualPraemienDailyApisAllowed(params.companyIdStr);
  if (!gate.allowed) {
    return { ok: false, statusCode: gate.statusCode, message: gate.message };
  }

  if (!isValidPraemienYearMonth(params.year, params.month)) {
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

  const raw: ManualDailyEntryDto[] = rows
    .map((doc) => mapManualDailyDocToDto(doc as unknown as Record<string, unknown>))
    .filter((e): e is ManualDailyEntryDto => e != null);

  let entries = await enrichManualDailyDtosWithAdminNames(raw);
  if (params.applyWorkerFacing) {
    entries = entries.map(toWorkerFacingManualDailyDto);
  }
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

  const raw = mapManualDailyDocToDto(doc as unknown as Record<string, unknown>);
  if (!raw) {
    return { ok: true, entry: null };
  }
  return {
    ok: true,
    entry: toWorkerFacingManualDailyDto(await enrichManualDailyDto(raw)),
  };
}

export async function getMyFinalClosureDateKeysForMonth(params: {
  companyIdStr: string | undefined;
  userId: string;
  year: number;
  month: number;
}): Promise<
  | { ok: true; dates: string[] }
  | { ok: false; statusCode: number; message: string }
> {
  const gate = await assertManualPraemienDailyApisAllowed(params.companyIdStr);
  if (!gate.allowed) {
    return { ok: false, statusCode: gate.statusCode, message: gate.message };
  }

  if (!isValidPraemienYearMonth(params.year, params.month)) {
    return { ok: false, statusCode: 400, message: "Año o mes inválido." };
  }

  if (gate.workdayEnabled) {
    const dates = await listUserFinalWorkdayClosureDatesInMonth({
      companyObjectId: gate.companyObjectId,
      userId: params.userId,
      year: params.year,
      month: params.month,
    });
    return { ok: true, dates };
  }

  // Manual-only companies (without digital workday) can register values
  // independently for any valid calendar day from effective start up to today.
  const monthStart = new Date(params.year, params.month - 1, 1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(params.year, params.month, 0);
  monthEnd.setHours(0, 0, 0, 0);
  const effectiveStart = new Date(
    gate.effectiveFrom.year,
    gate.effectiveFrom.month - 1,
    1,
  );
  effectiveStart.setHours(0, 0, 0, 0);
  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const start =
    monthStart > effectiveStart ? monthStart : effectiveStart;
  const end = monthEnd < todayStart ? monthEnd : todayStart;
  if (end < start) {
    return { ok: true, dates: [] };
  }
  return { ok: true, dates: listDateKeysInRange(start, end) };
}
