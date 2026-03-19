import axios from "../../../api/axios";
import type { WorkdayIssue } from "./types";

export const getAllIssueReports = async (): Promise<WorkdayIssue[]> => {
  try {
    const res = await axios.get<WorkdayIssue[]>("/workday-summary/issues");
    return res.data;
  } catch {
    // Mantener el mismo mensaje de error que con fetch (!res.ok)
    throw new Error("Error al obtener reportes técnicos");
  }
};

// Borrar reporte
export const deleteIssueReport = async (id: string): Promise<void> => {
  await axios.delete(`/workday-summary/issues/${id}`);
};

/* =========================
   NUEVO: marcar AVERÍA como vista
   ========================= */

/**
 * Marca una avería como vista (isSeen=true, seenAt=now).
 * PATCH /workday-summary/issues/:id/seen
 */
export const markIssueSeen = async (id: string): Promise<WorkdayIssue> => {
  const res = await axios.patch(`/workday-summary/issues/${id}/seen`, null);
  return res.data as WorkdayIssue;
};

interface IssuesCountResponse {
  count: number;
}

export const getIssuesOpenCount = async (): Promise<number> => {
  try {
    const res = await axios.get<IssuesCountResponse>(
      "/workday-summary/issues/count",
      {
        params: { status: "open" },
      },
    );
    return typeof res.data?.count === "number" ? res.data.count : 0;
  } catch (err: any) {
    const msg =
      err?.response?.data?.message ||
      err?.message ||
      "Error al obtener el contador de averías abiertas";
    throw new Error(msg);
  }
};

export const getIssuesCountByStatus = async (
  status: string,
): Promise<number> => {
  try {
    const res = await axios.get<IssuesCountResponse>(
      "/workday-summary/issues/count",
      {
        params: { status },
      },
    );
    return typeof res.data?.count === "number" ? res.data.count : 0;
  } catch (err: any) {
    const msg =
      err?.response?.data?.message ||
      err?.message ||
      "Error al obtener el contador de averías";
    throw new Error(msg);
  }
};
