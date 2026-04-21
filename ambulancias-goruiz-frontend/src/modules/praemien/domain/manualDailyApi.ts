import axios from "../../../api/axios";

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
  reopenedAt: string | null;
  reopenedBy: string | null;
  reopenNote: string | null;
}

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

export async function postAdminManualDailyApprove(body: {
  userId: string;
  date: string;
  adminFinalValue?: number;
}): Promise<ManualDailyEntryDto> {
  const res = await axios.post<ManualDailyEntryDto>(
    "/praemien/manual-daily/admin/approve",
    body,
  );
  return res.data;
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

export async function postAdminManualDailyCorrectApprove(body: {
  userId: string;
  date: string;
  adminFinalValue: number;
}): Promise<ManualDailyEntryDto> {
  const res = await axios.post<ManualDailyEntryDto>(
    "/praemien/manual-daily/admin/correct-approve",
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
