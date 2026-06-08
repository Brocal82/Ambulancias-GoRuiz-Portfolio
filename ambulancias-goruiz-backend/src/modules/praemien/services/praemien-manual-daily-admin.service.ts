import mongoose from "mongoose";
import User from "../../users/models/user.model";
import WorkdaySummary from "../../workday-summary/models/workday-summary.model";
import PraemienManualDailyEntry from "../models/praemien-manual-daily-entry.model";
import type { PraemienManualDailyStatus } from "../models/praemien-manual-daily-entry.model";
import { sendPushNotification, voidEmitPraemienAdminSideEffects, voidEmitPraemienWorkerRefresh } from "../../notifications";
import {
  assertManualPraemienDailyApisAllowed,
} from "./assert-manual-praemien-phase.service";
import { enrichManualDailyDto } from "./enrich-manual-daily-dto-admin-names";
import { parseManualPraemieNumericValue } from "./manual-praemie-value-parse";
import {
  mapManualDailyDocToDto,
  type ManualDailyEntryDto,
} from "./praemien-manual-daily-mapper";
import { findDienstPartnerUserIdsForManualDay } from "./manual-daily-dienst-teammates";
import { listMyManualDailyEntriesForMonth } from "./praemien-manual-daily.service";
import { legacyAwareWorkdayCompanyFilter } from "../utils/legacyWorkdayCompanyFilter";


export type { ManualDailyEntryDto };

/** Minimal production trace (ids + action); no full audit subsystem. */
function logPraemienAdminAction(
  action:
    | "approve"
    | "reject"
    | "correctApprove"
    | "reopen"
    | "teammateSync",
  meta: {
    companyId?: string;
    targetUserId: string;
    date: string;
    adminUserId: string;
  },
): void {
  console.info(
    "[praemien-admin]",
    JSON.stringify({
      action,
      companyId: meta.companyId ?? null,
      targetUserId: meta.targetUserId,
      date: meta.date,
      adminUserId: meta.adminUserId,
      at: new Date().toISOString(),
    }),
  );
}

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
    applyWorkerFacing: false,
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
    return { ok: true, value: Math.round(fallback * 100) / 100 };
  }
  return parseManualPraemieNumericValue(raw);
}

/**
 * Alinea una entrada manual de un compañero de Dienst al valor final aprobado (crear / actualizar).
 */
async function applyManualDailyPartnerApproveSync(params: {
  companyIdStr: string | undefined;
  companyObjectId: mongoose.Types.ObjectId;
  partnerUserId: string;
  dateStr: string;
  adminUserId: string;
  finalValue: number;
}): Promise<boolean> {
  const partnerId = String(params.partnerUserId).trim();
  if (!mongoose.Types.ObjectId.isValid(partnerId)) {
    return false;
  }
  const partnerOid = new mongoose.Types.ObjectId(partnerId);
  const adminOid = new mongoose.Types.ObjectId(params.adminUserId);
  const now = new Date();
  const co = params.companyObjectId;
  const finalVal = Math.round(params.finalValue * 100) / 100;

  const existing = await PraemienManualDailyEntry.findOne({
    companyId: co,
    userId: partnerOid,
    date: params.dateStr,
  }).lean();

  if (!existing) {
    await PraemienManualDailyEntry.create({
      companyId: co,
      userId: partnerOid,
      date: params.dateStr,
      originalWorkerValue: finalVal,
      workerSubmittedValue: finalVal,
      workerSubmittedAt: now,
      status: "approved",
      adminFinalValue: finalVal,
      adminReviewedAt: now,
      adminReviewedBy: adminOid,
      rejectionReason: null,
    });
    logPraemienAdminAction("teammateSync", {
      companyId: params.companyIdStr,
      targetUserId: partnerId,
      date: params.dateStr,
      adminUserId: params.adminUserId,
    });
    void sendPushNotification(
      [partnerId],
      "Prämie manual aprobada",
      `Tu Prämie manual del ${params.dateStr} ha sido aprobada.`,
      { screen: "praemien" },
    );
    return true;
  }

  const st = String(existing.status ?? "");
  if (st === "rejected") {
    console.warn(
      "[praemien-admin] teammate sync skipped (rejected)",
      JSON.stringify({ partnerId, date: params.dateStr }),
    );
    return false;
  }

  if (st === "approved") {
    const rawFinal = existing.adminFinalValue as unknown;
    const curFinal =
      rawFinal != null &&
      rawFinal !== "" &&
      Number.isFinite(Number(rawFinal))
        ? Number(rawFinal)
        : Number(existing.workerSubmittedValue ?? 0);
    if (Math.abs(curFinal - finalVal) < 1e-9) {
      return false;
    }
  }

  const setDoc: Record<string, unknown> = {
    workerSubmittedValue: finalVal,
    workerSubmittedAt: now,
    status: "approved",
    adminFinalValue: finalVal,
    adminReviewedAt: now,
    adminReviewedBy: adminOid,
    rejectionReason: null,
  };
  if (existing.originalWorkerValue == null) {
    setDoc.originalWorkerValue = Number(existing.workerSubmittedValue ?? 0);
  }

  await PraemienManualDailyEntry.updateOne(
    { _id: existing._id },
    { $set: setDoc },
  );
  logPraemienAdminAction("teammateSync", {
    companyId: params.companyIdStr,
    targetUserId: partnerId,
    date: params.dateStr,
    adminUserId: params.adminUserId,
  });
  void sendPushNotification(
    [partnerId],
    "Prämie manual aprobada",
    `Tu Prämie manual del ${params.dateStr} ha sido aprobada.`,
    { screen: "praemien" },
  );
  return true;
}

function uniqueWorkerIdsForPraemienRefresh(
  primaryUserId: string,
  partnerUserIds: Iterable<string>,
): string[] {
  const ids = new Set<string>();
  const primary = String(primaryUserId).trim();
  if (primary) ids.add(primary);
  for (const raw of partnerUserIds) {
    const id = String(raw).trim();
    if (id) ids.add(id);
  }
  return [...ids];
}

function emitPraemienRefreshForApproval(params: {
  companyIdStr: string;
  primaryUserId: string;
  syncedPartnerUserIds: string[];
}): void {
  voidEmitPraemienWorkerRefresh(
    uniqueWorkerIdsForPraemienRefresh(params.primaryUserId, params.syncedPartnerUserIds),
    params.companyIdStr,
  );
  voidEmitPraemienAdminSideEffects(params.companyIdStr);
}

/**
 * Tras aprobar/corregir la Prämie manual de un trabajador, alinea al resto de plazas del mismo
 * cierre final (mismo día / Dienst) con el mismo valor final.
 */
async function syncTeammateManualDailyToAdminFinal(params: {
  companyIdStr: string | undefined;
  primaryUserId: string;
  date: string;
  adminUserId: string;
  finalValue: number;
}): Promise<string[]> {
  const gate = await assertManualPraemienDailyApisAllowed(params.companyIdStr);
  if (!gate.allowed) {
    return [];
  }

  const dateStr = typeof params.date === "string" ? params.date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return [];
  }

  const partnerIds = await findDienstPartnerUserIdsForManualDay({
    companyObjectId: gate.companyObjectId,
    targetUserId: params.primaryUserId,
    date: dateStr,
  });
  const finalVal = Math.round(params.finalValue * 100) / 100;
  const syncedPartnerIds: string[] = [];

  for (const partnerId of partnerIds) {
    const synced = await applyManualDailyPartnerApproveSync({
      companyIdStr: params.companyIdStr,
      companyObjectId: gate.companyObjectId,
      partnerUserId: partnerId,
      dateStr,
      adminUserId: params.adminUserId,
      finalValue: finalVal,
    });
    if (synced) {
      syncedPartnerIds.push(partnerId);
    }
  }

  return syncedPartnerIds;
}

export async function adminApproveManualDailyEntry(params: {
  companyIdStr: string | undefined;
  targetUserId: string;
  date: string;
  adminUserId: string;
  adminFinalValue?: unknown;
  /** Si es true (defecto), aprueba también al compañero de Dienst el mismo día si sigue pendiente. */
  cascadeTeammate?: boolean;
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
  if (st === "draft") {
    return {
      ok: false,
      statusCode: 400,
      message:
        "La entrada está en borrador. El trabajador debe enviarla antes de aprobarla.",
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
  logPraemienAdminAction("approve", {
    companyId: params.companyIdStr,
    targetUserId: params.targetUserId,
    date: params.date,
    adminUserId: params.adminUserId,
  });

  void sendPushNotification(
    [params.targetUserId],
    "Prämie manual aprobada",
    `Tu Prämie manual del ${params.date} ha sido aprobada.`,
    { screen: "praemien" },
  );

  const shouldCascade = params.cascadeTeammate !== false;
  let syncedPartnerIds: string[] = [];
  if (shouldCascade) {
    syncedPartnerIds = await syncTeammateManualDailyToAdminFinal({
      companyIdStr: params.companyIdStr,
      primaryUserId: params.targetUserId,
      date: params.date,
      adminUserId: params.adminUserId,
      finalValue: parsed.value,
    });
  }

  if (params.companyIdStr) {
    emitPraemienRefreshForApproval({
      companyIdStr: params.companyIdStr,
      primaryUserId: params.targetUserId,
      syncedPartnerUserIds: syncedPartnerIds,
    });
  }

  return { ok: true, entry: await enrichManualDailyDto(dto) };
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
  if (st === "draft") {
    return {
      ok: false,
      statusCode: 400,
      message:
        "La entrada está en borrador. No se puede rechazar hasta que el trabajador la envíe.",
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
  logPraemienAdminAction("reject", {
    companyId: params.companyIdStr,
    targetUserId: params.targetUserId,
    date: params.date,
    adminUserId: params.adminUserId,
  });
  void sendPushNotification(
    [params.targetUserId],
    "Prämie manual rechazada",
    `Tu Prämie manual del ${params.date} ha sido rechazada. Revisa el motivo en la app.`,
    { screen: "praemien" },
  );
  if (params.companyIdStr) {
    voidEmitPraemienWorkerRefresh([params.targetUserId], params.companyIdStr);
    voidEmitPraemienAdminSideEffects(params.companyIdStr);
  }
  return { ok: true, entry: await enrichManualDailyDto(dto) };
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
  if (st === "draft") {
    return {
      ok: false,
      statusCode: 400,
      message:
        "La entrada está en borrador. El trabajador debe enviarla antes de corregir y aprobar.",
    };
  }

  const valueParsed = parseManualPraemieNumericValue(params.adminFinalValue);
  if (!valueParsed.ok) {
    return { ok: false, statusCode: 400, message: valueParsed.message };
  }
  const num = valueParsed.value;

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
  logPraemienAdminAction("correctApprove", {
    companyId: params.companyIdStr,
    targetUserId: params.targetUserId,
    date: params.date,
    adminUserId: params.adminUserId,
  });

  const syncedPartnerIds = await syncTeammateManualDailyToAdminFinal({
    companyIdStr: params.companyIdStr,
    primaryUserId: params.targetUserId,
    date: params.date,
    adminUserId: params.adminUserId,
    finalValue: num,
  });

  if (params.companyIdStr) {
    emitPraemienRefreshForApproval({
      companyIdStr: params.companyIdStr,
      primaryUserId: params.targetUserId,
      syncedPartnerUserIds: syncedPartnerIds,
    });
  }

  return { ok: true, entry: await enrichManualDailyDto(dto) };
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
  logPraemienAdminAction("reopen", {
    companyId: params.companyIdStr,
    targetUserId: params.targetUserId,
    date: params.date,
    adminUserId: params.adminUserId,
  });
  if (params.companyIdStr) {
    voidEmitPraemienWorkerRefresh([params.targetUserId], params.companyIdStr);
    voidEmitPraemienAdminSideEffects(params.companyIdStr);
  }
  return { ok: true, entry: await enrichManualDailyDto(dto) };
}

/**
 * Entradas manuales con estado `submitted` o `reopened` pendientes de acción del admin.
 * Devuelve 0 si el modo manual no aplica a la empresa.
 */
export async function countPendingManualPraemieForCompany(
  companyIdStr: string | undefined,
): Promise<number> {
  const gate = await assertManualPraemienDailyApisAllowed(companyIdStr);
  if (!gate.allowed) {
    return 0;
  }
  return PraemienManualDailyEntry.countDocuments({
    companyId: gate.companyObjectId,
    status: { $in: ["submitted", "reopened"] },
  });
}

export type PendingManualPraemieByUser = { userId: string; count: number };

/**
 * Trabajadores con al menos una entrada `submitted` o `reopened` (para listado admin).
 */
export async function listPendingManualPraemieByUser(
  companyIdStr: string | undefined,
): Promise<PendingManualPraemieByUser[]> {
  const gate = await assertManualPraemienDailyApisAllowed(companyIdStr);
  if (!gate.allowed) {
    return [];
  }
  const rows = await PraemienManualDailyEntry.aggregate<{
    _id: mongoose.Types.ObjectId;
    count: number;
  }>([
    {
      $match: {
        companyId: gate.companyObjectId,
        status: { $in: ["submitted", "reopened"] },
      },
    },
    { $group: { _id: "$userId", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);
  return rows.map((r) => ({
    userId: String(r._id),
    count: r.count,
  }));
}

export type PendingManualPraemieListEntry = {
  userId: string;
  name: string;
  lastName: string;
  /** Número de personal / trabajador (User.employeeNumber). */
  employeeNumber: string | null;
  date: string;
  dienstNumber: number | null;
  startTime: string | null;
  endTime: string | null;
  /** Valor numérico enviado por el trabajador (Prämie manual). */
  workerSubmittedValue: number;
  status: "submitted" | "reopened";
  /** Conductor del Dienst = «Trabajador 1» en UI. */
  equipoDriverUserId: string | null;
  equipoDriverName: string;
  equipoDriverLastName: string;
  equipoDriverEmployeeNumber: string | null;
  /** Médico del Dienst = «Trabajador 2» en UI. */
  equipoMedicUserId: string | null;
  equipoMedicName: string;
  equipoMedicLastName: string;
  equipoMedicEmployeeNumber: string | null;
  /** Conductor y médico con entrada pendiente el mismo día (un ✅ puede cerrar ambas). */
  equipoBothSlotsPending: boolean;
};

function pickWorkdayForUserDate(
  summaries: {
    date?: string;
    driver?: unknown;
    medic?: unknown;
    dienstNumber?: number;
    startTime?: string;
    endTime?: string;
  }[],
  userId: string,
  dateStr: string,
):
  | {
      dienstNumber: number | null;
      startTime: string | null;
      endTime: string | null;
      driverUserId: string | null;
      medicUserId: string | null;
    }
  | null {
  for (const s of summaries) {
    if (String(s.date) !== dateStr) continue;
    const d = s.driver != null ? String(s.driver) : "";
    const m = s.medic != null ? String(s.medic) : "";
    if (d === userId || m === userId) {
      const driverUserId = d && d !== "" ? d : null;
      const medicUserId = m && m !== "" ? m : null;
      return {
        dienstNumber:
          typeof s.dienstNumber === "number" && Number.isFinite(s.dienstNumber)
            ? s.dienstNumber
            : null,
        startTime: s.startTime != null ? String(s.startTime) : null,
        endTime: s.endTime != null ? String(s.endTime) : null,
        driverUserId,
        medicUserId,
      };
    }
  }
  return null;
}

/**
 * Listado detallado de días con Prämie manual pendiente: equipo, fecha, cierre de jornada
 * (Dienst, horario) y valor enviado.
 */
export async function listPendingManualPraemieEntriesEnriched(
  companyIdStr: string | undefined,
): Promise<PendingManualPraemieListEntry[]> {
  const gate = await assertManualPraemienDailyApisAllowed(companyIdStr);
  if (!gate.allowed) {
    return [];
  }

  const entries = await PraemienManualDailyEntry.find({
    companyId: gate.companyObjectId,
    status: { $in: ["submitted", "reopened"] },
  })
    .sort({ date: 1, userId: 1 })
    .lean();

  if (entries.length === 0) {
    return [];
  }

  const co = gate.companyObjectId;
  const userOidList = [
    ...new Set(entries.map((e) => String(e.userId))),
  ].map((id) => new mongoose.Types.ObjectId(id));
  const uniqueDates = [...new Set(entries.map((e) => String(e.date)))];

  const summaries = await WorkdaySummary.find({
    $and: [
      { date: { $in: uniqueDates } },
      { isFinalClosure: true },
      legacyAwareWorkdayCompanyFilter(co),
      { $or: [{ driver: { $in: userOidList } }, { medic: { $in: userOidList } }] },
    ],
  })
    .select("date driver medic dienstNumber startTime endTime")
    .lean();

  const summaryRows = summaries as {
    date?: string;
    driver?: unknown;
    medic?: unknown;
    dienstNumber?: number;
    startTime?: string;
    endTime?: string;
  }[];

  const dienstSeatUserIds = new Set<string>();
  for (const e of entries) {
    const uid = String(e.userId);
    const dateStr = String(e.date);
    const ws = pickWorkdayForUserDate(summaryRows, uid, dateStr);
    if (ws?.driverUserId) {
      dienstSeatUserIds.add(ws.driverUserId);
    }
    if (ws?.medicUserId) {
      dienstSeatUserIds.add(ws.medicUserId);
    }
  }

  const allUserIds = [
    ...new Set([...userOidList.map((o) => String(o)), ...dienstSeatUserIds]),
  ].map((id) => new mongoose.Types.ObjectId(id));

  const users = await User.find({ _id: { $in: allUserIds } })
    .select("name lastName employeeNumber")
    .lean();
  const userMap = new Map(
    users.map((u) => {
      const raw = (u as { employeeNumber?: unknown }).employeeNumber;
      const en =
        raw == null || raw === ""
          ? null
          : String(raw).trim() || null;
      return [
        String(u._id),
        {
          name: String(u.name ?? ""),
          lastName: String(u.lastName ?? ""),
          employeeNumber: en,
        },
      ];
    }),
  );

  const pendingByUserDate = new Set(
    entries.map((e) => `${String(e.userId)}|${String(e.date)}`),
  );

  const out: PendingManualPraemieListEntry[] = [];
  for (const e of entries) {
    const uid = String(e.userId);
    const u = userMap.get(uid) ?? {
      name: "",
      lastName: "",
      employeeNumber: null as string | null,
    };
    const dateStr = String(e.date);
    const ws = pickWorkdayForUserDate(summaryRows, uid, dateStr);
    const w = Number(e.workerSubmittedValue ?? 0);
    let dId = ws?.driverUserId ?? null;
    let mId = ws?.medicUserId ?? null;
    if (!ws) {
      dId = uid;
      mId = null;
    }
    const empty = {
      name: "",
      lastName: "",
      employeeNumber: null as string | null,
    };
    const du = dId ? userMap.get(dId) ?? empty : null;
    const mu = mId ? userMap.get(mId) ?? empty : null;
    const dPend = !!(dId && pendingByUserDate.has(`${dId}|${dateStr}`));
    const mPend = !!(mId && pendingByUserDate.has(`${mId}|${dateStr}`));
    const equipoBothSlotsPending = !!(dId && mId && dPend && mPend);
    out.push({
      userId: uid,
      name: u.name,
      lastName: u.lastName,
      employeeNumber: u.employeeNumber,
      date: dateStr,
      dienstNumber: ws?.dienstNumber ?? null,
      startTime: ws?.startTime ?? null,
      endTime: ws?.endTime ?? null,
      workerSubmittedValue: Number.isFinite(w) ? w : 0,
      status: (e.status === "reopened" ? "reopened" : "submitted") as
        | "submitted"
        | "reopened",
      equipoDriverUserId: dId,
      equipoDriverName: du?.name ?? "",
      equipoDriverLastName: du?.lastName ?? "",
      equipoDriverEmployeeNumber: du?.employeeNumber ?? null,
      equipoMedicUserId: mId,
      equipoMedicName: mu?.name ?? "",
      equipoMedicLastName: mu?.lastName ?? "",
      equipoMedicEmployeeNumber: mu?.employeeNumber ?? null,
      equipoBothSlotsPending,
    });
  }
  return out;
}

/** Misma información de columna que el listado de pendientes, para cualquier estado de la entrada manual. */
export type AdminManualPraemieDayQueueRow = {
  userId: string;
  name: string;
  lastName: string;
  employeeNumber: string | null;
  date: string;
  dienstNumber: number | null;
  startTime: string | null;
  endTime: string | null;
  workerSubmittedValue: number;
  equipoDriverUserId: string | null;
  equipoDriverName: string;
  equipoDriverLastName: string;
  equipoDriverEmployeeNumber: string | null;
  equipoMedicUserId: string | null;
  equipoMedicName: string;
  equipoMedicLastName: string;
  equipoMedicEmployeeNumber: string | null;
  equipoBothSlotsPending: boolean;
  manualStatus: PraemienManualDailyStatus;
  adminFinalValue: number | null;
  rejectionReason: string | null;
};

export async function adminGetManualPraemieDayQueueRow(params: {
  companyIdStr: string | undefined;
  targetUserId: string;
  date: string;
}): Promise<
  | { ok: true; row: AdminManualPraemieDayQueueRow }
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
  const co = gate.companyObjectId;
  const uid = String(params.targetUserId);

  const entry = await PraemienManualDailyEntry.findOne({
    companyId: co,
    userId: userOid,
    date: dateStr,
  }).lean();

  if (!entry) {
    return { ok: false, statusCode: 404, message: "Entrada no encontrada." };
  }

  const manualStatus = String(entry.status ?? "draft") as PraemienManualDailyStatus;

  const summaries = await WorkdaySummary.find({
    $and: [
      { date: dateStr },
      { isFinalClosure: true },
      legacyAwareWorkdayCompanyFilter(co),
      { $or: [{ driver: userOid }, { medic: userOid }] },
    ],
  })
    .select("date driver medic dienstNumber startTime endTime")
    .lean();

  const summaryRows = summaries as {
    date?: string;
    driver?: unknown;
    medic?: unknown;
    dienstNumber?: number;
    startTime?: string;
    endTime?: string;
  }[];

  const ws = pickWorkdayForUserDate(summaryRows, uid, dateStr);
  let dId = ws?.driverUserId ?? null;
  let mId = ws?.medicUserId ?? null;
  if (!ws) {
    dId = uid;
    mId = null;
  }

  const seatOids: mongoose.Types.ObjectId[] = [];
  if (dId) seatOids.push(new mongoose.Types.ObjectId(dId));
  if (mId) seatOids.push(new mongoose.Types.ObjectId(mId));

  const pendingRows =
    seatOids.length > 0
      ? await PraemienManualDailyEntry.find({
          companyId: co,
          date: dateStr,
          status: { $in: ["submitted", "reopened"] },
          userId: { $in: seatOids },
        })
          .select("userId")
          .lean()
      : [];

  const pendingSet = new Set(
    pendingRows.map((r) => `${String(r.userId)}|${dateStr}`),
  );
  const dPend = !!(dId && pendingSet.has(`${dId}|${dateStr}`));
  const mPend = !!(mId && pendingSet.has(`${mId}|${dateStr}`));
  const equipoBothSlotsPending = !!(dId && mId && dPend && mPend);

  const allUserIds = [
    ...new Set([uid, ...(dId ? [dId] : []), ...(mId ? [mId] : [])]),
  ].map((id) => new mongoose.Types.ObjectId(id));

  const users = await User.find({ _id: { $in: allUserIds } })
    .select("name lastName employeeNumber")
    .lean();

  const userMap = new Map(
    users.map((u) => {
      const raw = (u as { employeeNumber?: unknown }).employeeNumber;
      const en =
        raw == null || raw === ""
          ? null
          : String(raw).trim() || null;
      return [
        String(u._id),
        {
          name: String(u.name ?? ""),
          lastName: String(u.lastName ?? ""),
          employeeNumber: en,
        },
      ];
    }),
  );

  const empty = {
    name: "",
    lastName: "",
    employeeNumber: null as string | null,
  };
  const u = userMap.get(uid) ?? empty;
  const du = dId ? userMap.get(dId) ?? empty : null;
  const mu = mId ? userMap.get(mId) ?? empty : null;

  const w = Number(entry.workerSubmittedValue ?? 0);
  const adminRaw = entry.adminFinalValue as unknown;
  const adminFinalValue =
    adminRaw != null &&
    adminRaw !== "" &&
    Number.isFinite(Number(adminRaw))
      ? Number(adminRaw)
      : null;

  const rejRaw = entry.rejectionReason;
  const rejectionReason =
    rejRaw == null || rejRaw === ""
      ? null
      : String(rejRaw).trim() || null;

  const row: AdminManualPraemieDayQueueRow = {
    userId: uid,
    name: u.name,
    lastName: u.lastName,
    employeeNumber: u.employeeNumber,
    date: dateStr,
    dienstNumber: ws?.dienstNumber ?? null,
    startTime: ws?.startTime ?? null,
    endTime: ws?.endTime ?? null,
    workerSubmittedValue: Number.isFinite(w) ? w : 0,
    equipoDriverUserId: dId,
    equipoDriverName: du?.name ?? "",
    equipoDriverLastName: du?.lastName ?? "",
    equipoDriverEmployeeNumber: du?.employeeNumber ?? null,
    equipoMedicUserId: mId,
    equipoMedicName: mu?.name ?? "",
    equipoMedicLastName: mu?.lastName ?? "",
    equipoMedicEmployeeNumber: mu?.employeeNumber ?? null,
    equipoBothSlotsPending,
    manualStatus,
    adminFinalValue,
    rejectionReason,
  };

  return { ok: true, row };
}
