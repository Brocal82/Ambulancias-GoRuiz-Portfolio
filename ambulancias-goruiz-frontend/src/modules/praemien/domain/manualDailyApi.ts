import axios from "../../../api/axios";

export type PraemienManualDailyStatus = "draft" | "submitted";

export interface ManualDailyEntryDto {
  date: string;
  workerSubmittedValue: number;
  workerSubmittedAt: string;
  status: PraemienManualDailyStatus;
}

export async function putMyManualDailyEntry(body: {
  date: string;
  workerSubmittedValue: number;
  status?: PraemienManualDailyStatus;
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
