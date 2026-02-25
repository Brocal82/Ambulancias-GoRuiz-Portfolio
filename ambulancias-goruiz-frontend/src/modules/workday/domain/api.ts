import axios from "../../../api/axios";
import type {
  PartialSummaryPayload,
  FinalSummaryPayload,
  WorkdaySummary,
} from "../../../types/workdaySummary";
import type { WorkdayIssue } from "../../../types/workdayIssue";

/* =========================
   EXISTENTES
   ========================= */

export const sendPartialClosure = async (
  data: PartialSummaryPayload,
  token: string,
) => {
  const res = await axios.post("/workday-summary/partial", data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const sendFinalClosure = async (
  data: FinalSummaryPayload,
  token: string,
) => {
  const res = await axios.post("/workday-summary", data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const getAllSummaries = async (
  token: string,
): Promise<WorkdaySummary[]> => {
  const res = await axios.get("/workday-summary", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const getAllIssueReports = async (
  token: string,
): Promise<WorkdayIssue[]> => {
  // Mantengo fetch como lo tienes para no romper nada
  const res = await fetch("/api/workday-summary/issues", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error("Error al obtener reportes técnicos");
  return res.json();
};

// Borrar reporte
export const deleteIssueReport = async (
  token: string,
  id: string,
): Promise<void> => {
  await axios.delete(`/workday-summary/issues/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

/* =========================
   NUEVO: marcar AVERÍA como vista
   ========================= */

/**
 * Marca una avería como vista (isSeen=true, seenAt=now).
 * PATCH /workday-summary/issues/:id/seen
 */
export const markIssueSeen = async (
  token: string,
  id: string,
): Promise<WorkdayIssue> => {
  const res = await axios.patch(`/workday-summary/issues/${id}/seen`, null, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data as WorkdayIssue;
};

/* =========================
   Contadores
   ========================= */

interface SummariesCountResponse {
  count: number;
}

export const getSummariesPendingCount = async (
  token: string,
  status: string = "pending",
): Promise<number> => {
  try {
    const res = await axios.get<SummariesCountResponse>(
      "/workday-summary/count",
      {
        params: { status },
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return typeof res.data?.count === "number" ? res.data.count : 0;
  } catch (err: any) {
    const msg =
      err?.response?.data?.message ||
      err?.message ||
      "Error al obtener el contador de summaries pendientes";
    throw new Error(msg);
  }
};

export const markSummaryReviewed = async (
  token: string,
  id: string,
): Promise<WorkdaySummary> => {
  try {
    const res = await axios.patch(`/workday-summary/${id}/review`, null, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data as WorkdaySummary;
  } catch (err: any) {
    const msg =
      err?.response?.data?.message ||
      err?.message ||
      "Error al marcar el resumen como revisado";
    throw new Error(msg);
  }
};

interface IssuesCountResponse {
  count: number;
}

export const getIssuesOpenCount = async (token: string): Promise<number> => {
  try {
    const res = await axios.get<IssuesCountResponse>(
      "/workday-summary/issues/count",
      {
        params: { status: "open" },
        headers: { Authorization: `Bearer ${token}` },
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
  token: string,
  status: string,
): Promise<number> => {
  try {
    const res = await axios.get<IssuesCountResponse>(
      "/workday-summary/issues/count",
      {
        params: { status },
        headers: { Authorization: `Bearer ${token}` },
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
