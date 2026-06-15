import axios from "../../../api/axios";
import type { WorkdaySummary } from "../../workday/domain/types/workdaySummary";

export type PraemienManualDailyStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "reopened";

export interface ManualDailyEntryDto {
  date: string;
  originalWorkerValue: number;
  workerSubmittedValue: number;
  workerSubmittedAt: string;
  adminFinalValue: number | null;
  status: PraemienManualDailyStatus;
  rejectionReason: string | null;
  adminReviewedAt: string | null;
  adminReviewedBy: string | null;
  /** Nombre del administrador que aprobó/rechazó (según flujo); resuelto en API. */
  adminReviewedByName: string | null;
  reopenedAt: string | null;
  reopenedBy: string | null;
  reopenNote: string | null;
  /** True when auto-submitted from a Dienst teammate's send. */
  submittedViaDienstPartnerSync?: boolean;
}

export type ManualDailyApproveResultDto = {
  entry: ManualDailyEntryDto;
  syncedTeammateUserIds: string[];
};

export async function putMyManualDailyEntry(body: {
  date: string;
  workerSubmittedValue: number;
  status?: "draft" | "submitted";
}): Promise<ManualDailyEntryDto> {
  const res = await axios.put<ManualDailyEntryDto>("/praemien/manual-daily", body);
  return res.data;
}

export async function getMyManualDailyEntriesForMonth(
  year: number,
  month: number,
): Promise<ManualDailyEntryDto[]> {
  const res = await axios.get<ManualDailyEntryDto[]>("/praemien/manual-daily/month", {
    params: { year, month },
  });
  return res.data;
}

/** Días YYYY-MM-DD con cierre final de jornada (Dienst) en ese mes, para el calendario manual. */
export async function getMyFinalClosureDatesForMonth(
  year: number,
  month: number,
): Promise<string[]> {
  const res = await axios.get<{ dates: string[] }>(
    "/praemien/manual-daily/final-closure-dates",
    { params: { year, month } },
  );
  return res.data.dates;
}

export async function getMyManualDailyEntryForDay(
  date: string,
): Promise<ManualDailyEntryDto | null> {
  const res = await axios.get<ManualDailyEntryDto | null>(
    "/praemien/manual-daily/day",
    { params: { date } },
  );
  return res.data;
}

export async function getAdminManualDailyMonth(
  userId: string,
  year: number,
  month: number,
): Promise<ManualDailyEntryDto[]> {
  const res = await axios.get<ManualDailyEntryDto[]>(
    "/praemien/manual-daily/admin/month",
    { params: { userId, year, month } },
  );
  return res.data;
}

export async function getAdminManualPraemiePendingCount(): Promise<number> {
  const res = await axios.get<{ count: number }>(
    "/praemien/manual-daily/admin/pending-count",
  );
  return typeof res.data?.count === "number" ? res.data.count : 0;
}

export type AdminManualPraemiePendingByUser = { userId: string; count: number };

export async function getAdminManualPraemiePendingByUser(): Promise<
  AdminManualPraemiePendingByUser[]
> {
  const res = await axios.get<{ items: AdminManualPraemiePendingByUser[] }>(
    "/praemien/manual-daily/admin/pending-by-user",
  );
  return Array.isArray(res.data?.items) ? res.data.items : [];
}

export type PraemienManualDailyStatusForAdmin =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "reopened";

/** Una fila por día pendiente, con cierre de jornada (Dienst, horario). */
export type AdminManualPraemiePendingListEntry = {
  userId: string;
  name: string;
  lastName: string;
  employeeNumber: string | null;
  date: string;
  dienstNumber: number | null;
  startTime: string | null;
  endTime: string | null;
  workerSubmittedValue: number;
  status: "submitted" | "reopened";
  equipoDriverUserId: string | null;
  equipoDriverName: string;
  equipoDriverLastName: string;
  equipoDriverEmployeeNumber: string | null;
  equipoMedicUserId: string | null;
  equipoMedicName: string;
  equipoMedicLastName: string;
  equipoMedicEmployeeNumber: string | null;
  equipoBothSlotsPending: boolean;
  /** Suma totalEffectivePatients de reportes parcial + final del Dienst. */
  workdayReportsTotalPraemie: number | null;
};

/** Misma forma que `GET .../day-queue-row` y filas enriquecidas del listado (UI unificada). */
export type AdminManualPraemieQueueRowData = Omit<
  AdminManualPraemiePendingListEntry,
  "status"
> & {
  manualStatus: PraemienManualDailyStatusForAdmin;
  adminFinalValue: number | null;
  rejectionReason: string | null;
  workdayReportsTotalPraemie: number | null;
};

function normalizeQueueRowData(
  r: AdminManualPraemieQueueRowData,
): AdminManualPraemieQueueRowData {
  return {
    ...r,
    equipoDriverUserId: r.equipoDriverUserId ?? null,
    equipoDriverName: r.equipoDriverName ?? "",
    equipoDriverLastName: r.equipoDriverLastName ?? "",
    equipoDriverEmployeeNumber: r.equipoDriverEmployeeNumber ?? null,
    equipoMedicUserId: r.equipoMedicUserId ?? null,
    equipoMedicName: r.equipoMedicName ?? "",
    equipoMedicLastName: r.equipoMedicLastName ?? "",
    equipoMedicEmployeeNumber: r.equipoMedicEmployeeNumber ?? null,
    equipoBothSlotsPending: Boolean(r.equipoBothSlotsPending),
    adminFinalValue:
      r.adminFinalValue != null && Number.isFinite(Number(r.adminFinalValue))
        ? Number(r.adminFinalValue)
        : null,
    rejectionReason:
      r.rejectionReason != null && String(r.rejectionReason).trim() !== ""
        ? String(r.rejectionReason).trim()
        : null,
    workdayReportsTotalPraemie:
      r.workdayReportsTotalPraemie != null &&
      Number.isFinite(Number(r.workdayReportsTotalPraemie))
        ? Number(r.workdayReportsTotalPraemie)
        : null,
  };
}

export function pendingListEntryToQueueRowData(
  r: AdminManualPraemiePendingListEntry,
): AdminManualPraemieQueueRowData {
  const { status, ...rest } = r;
  return normalizeQueueRowData({
    ...rest,
    manualStatus: status,
    adminFinalValue: null,
    rejectionReason: null,
    workdayReportsTotalPraemie: r.workdayReportsTotalPraemie ?? null,
  });
}

export async function getAdminManualPraemieDayWorkdaySummaries(
  userId: string,
  date: string,
): Promise<WorkdaySummary[]> {
  const res = await axios.get<{ summaries: WorkdaySummary[] }>(
    "/praemien/manual-daily/admin/day-workday-summaries",
    { params: { userId, date } },
  );
  return Array.isArray(res.data?.summaries) ? res.data.summaries : [];
}

export async function getAdminManualPraemieDayQueueRow(
  userId: string,
  date: string,
): Promise<AdminManualPraemieQueueRowData> {
  const res = await axios.get<AdminManualPraemieQueueRowData>(
    "/praemien/manual-daily/admin/day-queue-row",
    { params: { userId, date } },
  );
  return normalizeQueueRowData(res.data);
}

function normalizePendingListEntry(
  r: AdminManualPraemiePendingListEntry,
): AdminManualPraemiePendingListEntry {
  return {
    ...r,
    equipoDriverUserId: r.equipoDriverUserId ?? null,
    equipoDriverName: r.equipoDriverName ?? "",
    equipoDriverLastName: r.equipoDriverLastName ?? "",
    equipoDriverEmployeeNumber: r.equipoDriverEmployeeNumber ?? null,
    equipoMedicUserId: r.equipoMedicUserId ?? null,
    equipoMedicName: r.equipoMedicName ?? "",
    equipoMedicLastName: r.equipoMedicLastName ?? "",
    equipoMedicEmployeeNumber: r.equipoMedicEmployeeNumber ?? null,
    equipoBothSlotsPending: Boolean(r.equipoBothSlotsPending),
  };
}

export async function getAdminManualPraemiePendingEntries(): Promise<
  AdminManualPraemiePendingListEntry[]
> {
  const res = await axios.get<{ items: AdminManualPraemiePendingListEntry[] }>(
    "/praemien/manual-daily/admin/pending-entries",
  );
  const items = Array.isArray(res.data?.items) ? res.data.items : [];
  return items.map(normalizePendingListEntry);
}

export async function postAdminManualDailyApprove(body: {
  userId: string;
  date: string;
  adminFinalValue?: number;
  /** Por defecto el backend también aprueba al compañero de Dienst si sigue pendiente. */
  cascadeTeammate?: boolean;
}): Promise<ManualDailyApproveResultDto> {
  const res = await axios.post<ManualDailyApproveResultDto>(
    "/praemien/manual-daily/admin/approve",
    body,
  );
  return {
    entry: res.data.entry,
    syncedTeammateUserIds: Array.isArray(res.data.syncedTeammateUserIds)
      ? res.data.syncedTeammateUserIds
      : [],
  };
}

export async function postAdminManualDailyReject(body: {
  userId: string;
  date: string;
  reason?: string;
}): Promise<ManualDailyEntryDto> {
  const res = await axios.post<ManualDailyEntryDto>(
    "/praemien/manual-daily/admin/reject",
    body,
  );
  return res.data;
}

export async function postAdminManualDailyReopen(body: {
  userId: string;
  date: string;
  note?: string;
}): Promise<ManualDailyEntryDto> {
  const res = await axios.post<ManualDailyEntryDto>(
    "/praemien/manual-daily/admin/reopen",
    body,
  );
  return res.data;
}
