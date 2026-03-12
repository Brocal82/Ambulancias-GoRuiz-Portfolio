import axiosInstance from "../../../api/axios";
import type {
  SickFlagsByUser,
  SickLeave,
  SickLeaveStatus,
} from "./types";

export async function createSickLeave(payload: {
  startDate: string;
  endDate: string;
  note?: string;
  documentUrl?: string;
}): Promise<SickLeave> {
  const { data } = await axiosInstance.post("/sick-leaves", payload);
  return data;
}

export async function listMySickLeaves(): Promise<SickLeave[]> {
  const { data } = await axiosInstance.get("/sick-leaves/mine");
  return data;
}

export async function attachSickDocument(
  sickLeaveId: string,
  documentUrl: string,
): Promise<SickLeave> {
  const { data } = await axiosInstance.post(
    `/sick-leaves/${sickLeaveId}/attach-document`,
    {
      documentUrl,
    },
  );
  return data;
}

export async function attachSickDocumentFile(
  sickLeaveId: string,
  file: File,
): Promise<SickLeave> {
  const form = new FormData();
  form.append("document", file);

  const { data } = await axiosInstance.post(
    `/sick-leaves/${sickLeaveId}/attach-document-file`,
    form,
  );
  return data;
}

export async function adminListSickLeaves(params?: {
  status?: SickLeaveStatus;
  userId?: string;
}): Promise<SickLeave[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.userId) search.set("user", params.userId);

  const qs = search.toString();
  const url = qs ? `/sick-leaves?${qs}` : "/sick-leaves";

  const { data } = await axiosInstance.get(url);
  return data;
}

export async function adminAcceptSickLeave(
  sickLeaveId: string,
): Promise<SickLeave> {
  const { data } = await axiosInstance.post(
    `/sick-leaves/${sickLeaveId}/accept`,
  );
  return data;
}

export async function adminRejectSickLeave(
  sickLeaveId: string,
): Promise<SickLeave> {
  const { data } = await axiosInstance.post(
    `/sick-leaves/${sickLeaveId}/reject`,
  );
  return data;
}

export async function getSickFlagsInRange(params: {
  userIds: string[];
  fromISO: string;
  toISO: string;
  includeFullSpan?: boolean;
}): Promise<SickFlagsByUser> {
  const { data } = await axiosInstance.post<SickFlagsByUser>(
    "/sick-leaves/check-range",
    params,
  );
  return data;
}

export async function getSickLeavesPendingCount(
  token: string,
  status: SickLeaveStatus | "all" = "pending",
): Promise<number> {
  void token;

  if (status === "all") {
    const all = await adminListSickLeaves();
    return all.length;
  }

  const list = await adminListSickLeaves({ status: status as SickLeaveStatus });
  return list.length;
}
