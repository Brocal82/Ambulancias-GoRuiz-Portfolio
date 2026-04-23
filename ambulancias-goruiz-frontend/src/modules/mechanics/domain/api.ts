import axios from "../../../api/axios";
import { getApiErrorMessage } from "../../../utils/toast";
import type { MechanicsIssue } from "./types";

export interface ReportIssuePayload {
  assignmentId: string;
  dienstNumber: number;
  date: string;
  startTime: string;
  endTime: string;
  team: string;
  ambulanceNumber: string;
  ambulanceId?: string;
  finalKm: number;
  timestamp: string;
  issueText: string;
  driver: string;
  medic: string;
}

export const reportIssue = async (payload: ReportIssuePayload): Promise<void> => {
  await axios.post("/mechanics/report-issue", payload);
};

export const getAllIssueReports = async (): Promise<MechanicsIssue[]> => {
  try {
    const res = await axios.get<MechanicsIssue[]>("/mechanics/issues");
    return res.data;
  } catch {
    // Mantener el mismo mensaje de error que con fetch (!res.ok)
    throw new Error("Error al obtener reportes técnicos");
  }
};

// Borrar reporte
export const deleteIssueReport = async (id: string): Promise<void> => {
  await axios.delete(`/mechanics/issues/${id}`);
};

/* =========================
   NUEVO: marcar AVERÍA como vista
   ========================= */

/**
 * Marca una avería como vista (isSeen=true, seenAt=now).
 * PATCH /mechanics/issues/:id/seen
 */
export const markIssueSeen = async (id: string): Promise<MechanicsIssue> => {
  const res = await axios.patch(`/mechanics/issues/${id}/seen`, null);
  return res.data as MechanicsIssue;
};

interface IssuesCountResponse {
  count: number;
}

export const getIssuesOpenCount = async (): Promise<number> => {
  try {
    const res = await axios.get<IssuesCountResponse>(
      "/mechanics/issues/count",
      {
        params: { status: "open" },
      },
    );
    return typeof res.data?.count === "number" ? res.data.count : 0;
  } catch (err: unknown) {
    throw new Error(
      getApiErrorMessage(err, "Error al obtener el contador de averías abiertas"),
    );
  }
};

export const getIssuesCountByStatus = async (
  status: string,
): Promise<number> => {
  try {
    const res = await axios.get<IssuesCountResponse>(
      "/mechanics/issues/count",
      {
        params: { status },
      },
    );
    return typeof res.data?.count === "number" ? res.data.count : 0;
  } catch (err: unknown) {
    throw new Error(
      getApiErrorMessage(err, "Error al obtener el contador de averías"),
    );
  }
};
