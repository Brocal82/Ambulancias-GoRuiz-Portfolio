import mongoose from "mongoose";
import PraemienManualDailyEntry from "../models/praemien-manual-daily-entry.model";
import {
  assertManualPraemienDailyApisAllowed,
} from "./assert-manual-praemien-phase.service";
import {
  mapManualDailyDocToDto,
  type ManualDailyEntryDto,
} from "./praemien-manual-daily-mapper";
import { listMyManualDailyEntriesForMonth } from "./praemien-manual-daily.service";

const MAX_VALUE = 10_000;

export type { ManualDailyEntryDto };

export async function adminListManualDailyEntriesForMonth(params: {
  companyIdStr: string | undefined;
  targetUserId: string;
  year: number;
  month: number;
}): Promise<
  | { ok: true; entries: ManualDailyEntryDto[] }
  | { ok: false; statusCode: number; message: string }
> {
  return listMyManualDailyEntriesForMonth({
    companyIdStr: params.companyIdStr,
    userId: params.targetUserId,
    year: params.year,
    month: params.month,
  });
}

async function loadEntryForAdmin(params: {
  companyIdStr: string | undefined;
  targetUserId: string;
  date: string;
}): Promise<
  | { ok: true; doc: Record<string, unknown> }
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

  if (!mongoose.Types.ObjectId.isValid(params.targetUserId)) {
    return { ok: false, statusCode: 400, message: "userId inválido." };
  }

  const userOid = new mongoose.Types.ObjectId(params.targetUserId);

  const doc = await PraemienManualDailyEntry.findOne({
    companyId: gate.companyObjectId,
    userId: userOid,
    date: dateStr,
  }).lean();

  if (!doc) {
    return { ok: false, statusCode: 404, message: "Entrada no encontrada." };
  }

  return { ok: true, doc: doc as unknown as Record<string, unknown> };
}

function parseOptionalFinalValue(
  raw: unknown,
  fallback: number,
): { ok: true; value: number } | { ok: false; message: string } {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, value: fallback };
  }
  const num =
    typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0 || num > MAX_VALUE) {
    return {
      ok: false,
      message: `adminFinalValue debe ser un entero entre 0 y ${MAX_VALUE}.`,
    };
  }
  return { ok: true, value: num };
}

export async function adminApproveManualDailyEntry(params: {
  companyIdStr: string | undefined;
  targetUserId: string;
  date: string;
  adminUserId: string;
  adminFinalValue?: unknown;
}): Promise<
  | { ok: true; entry: ManualDailyEntryDto }
  | { ok: false; statusCode: number; message: string }
> {
  const loaded = await loadEntryForAdmin(params);
  if (!loaded.ok) return loaded;

  const st = String(loaded.doc.status ?? "");
  if (st === "approved") {
    return { ok: false, statusCode: 400, message: "La entrada ya está aprobada." };
  }
  if (st === "rejected") {
    return {
      ok: false,
      statusCode: 400,
      message: "La entrada está rechazada. El trabajador debe volver a enviarla.",
    };
  }

  const workerVal = Number(loaded.doc.workerSubmittedValue ?? 0);
  const parsed = parseOptionalFinalValue(params.adminFinalValue, workerVal);
  if (!parsed.ok) {
    return { ok: false, statusCode: 400, message: parsed.message };
  }

  const now = new Date();
  const adminOid = new mongoose.Types.ObjectId(params.adminUserId);

  await PraemienManualDailyEntry.updateOne(
    { _id: loaded.doc._id },
    {
      $set: {
        status: "approved",
        adminFinalValue: parsed.value,
        adminReviewedAt: now,
        adminReviewedBy: adminOid,
        rejectionReason: null,
      },
    },
  );

  const fresh = await PraemienManualDailyEntry.findById(loaded.doc._id).lean();
  const dto = mapManualDailyDocToDto(fresh as unknown as Record<string, unknown>);
  if (!dto) {
    return { ok: false, statusCode: 500, message: "Error al leer la entrada." };
  }
  return { ok: true, entry: dto };
}

export async function adminRejectManualDailyEntry(params: {
  companyIdStr: string | undefined;
  targetUserId: string;
  date: string;
  adminUserId: string;
  reason?: unknown;
}): Promise<
  | { ok: true; entry: ManualDailyEntryDto }
  | { ok: false; statusCode: number; message: string }
> {
  const loaded = await loadEntryForAdmin(params);
  if (!loaded.ok) return loaded;

  const st = String(loaded.doc.status ?? "");
  if (st === "approved") {
    return {
      ok: false,
      statusCode: 400,
      message: "La entrada está aprobada. Reábrala antes de rechazarla.",
    };
  }

  const reason =
    typeof params.reason === "string" ? params.reason.trim().slice(0, 2000) : "";

  const now = new Date();
  const adminOid = new mongoose.Types.ObjectId(params.adminUserId);

  await PraemienManualDailyEntry.updateOne(
    { _id: loaded.doc._id },
    {
      $set: {
        status: "rejected",
        rejectionReason: reason || null,
        adminFinalValue: null,
        adminReviewedAt: now,
        adminReviewedBy: adminOid,
      },
    },
  );

  const fresh = await PraemienManualDailyEntry.findById(loaded.doc._id).lean();
  const dto = mapManualDailyDocToDto(fresh as unknown as Record<string, unknown>);
  if (!dto) {
    return { ok: false, statusCode: 500, message: "Error al leer la entrada." };
  }
  return { ok: true, entry: dto };
}

export async function adminCorrectApproveManualDailyEntry(params: {
  companyIdStr: string | undefined;
  targetUserId: string;
  date: string;
  adminUserId: string;
  adminFinalValue: unknown;
}): Promise<
  | { ok: true; entry: ManualDailyEntryDto }
  | { ok: false; statusCode: number; message: string }
> {
  const loaded = await loadEntryForAdmin(params);
  if (!loaded.ok) return loaded;

  const st = String(loaded.doc.status ?? "");
  if (st === "approved") {
    return { ok: false, statusCode: 400, message: "La entrada ya está aprobada." };
  }
  if (st === "rejected") {
    return {
      ok: false,
      statusCode: 400,
      message: "La entrada está rechazada. El trabajador debe volver a enviarla.",
    };
  }

  const raw = params.adminFinalValue;
  const num =
    typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0 || num > MAX_VALUE) {
    return {
      ok: false,
      statusCode: 400,
      message: "Debe indicar adminFinalValue (entero entre 0 y 10000).",
    };
  }

  const now = new Date();
  const adminOid = new mongoose.Types.ObjectId(params.adminUserId);

  await PraemienManualDailyEntry.updateOne(
    { _id: loaded.doc._id },
    {
      $set: {
        status: "approved",
        adminFinalValue: num,
        adminReviewedAt: now,
        adminReviewedBy: adminOid,
        rejectionReason: null,
      },
    },
  );

  const fresh = await PraemienManualDailyEntry.findById(loaded.doc._id).lean();
  const dto = mapManualDailyDocToDto(fresh as unknown as Record<string, unknown>);
  if (!dto) {
    return { ok: false, statusCode: 500, message: "Error al leer la entrada." };
  }
  return { ok: true, entry: dto };
}

export async function adminReopenManualDailyEntry(params: {
  companyIdStr: string | undefined;
  targetUserId: string;
  date: string;
  adminUserId: string;
  note?: unknown;
}): Promise<
  | { ok: true; entry: ManualDailyEntryDto }
  | { ok: false; statusCode: number; message: string }
> {
  const loaded = await loadEntryForAdmin(params);
  if (!loaded.ok) return loaded;

  const st = String(loaded.doc.status ?? "");
  if (st !== "approved") {
    return {
      ok: false,
      statusCode: 400,
      message: "Solo se pueden reabrir entradas aprobadas.",
    };
  }

  const note =
    typeof params.note === "string" ? params.note.trim().slice(0, 2000) : "";

  const now = new Date();
  const adminOid = new mongoose.Types.ObjectId(params.adminUserId);

  await PraemienManualDailyEntry.updateOne(
    { _id: loaded.doc._id },
    {
      $set: {
        status: "reopened",
        reopenedAt: now,
        reopenedBy: adminOid,
        reopenNote: note || null,
      },
    },
  );

  const fresh = await PraemienManualDailyEntry.findById(loaded.doc._id).lean();
  const dto = mapManualDailyDocToDto(fresh as unknown as Record<string, unknown>);
  if (!dto) {
    return { ok: false, statusCode: 500, message: "Error al leer la entrada." };
  }
  return { ok: true, entry: dto };
}
