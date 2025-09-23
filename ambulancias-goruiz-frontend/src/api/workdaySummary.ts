// frontend/src/api/workdaySummary.ts
import axios from "./axios";
import type { PartialSummaryPayload, FinalSummaryPayload, WorkdaySummary } from "../types/workdaySummary"; // añade FinalSummaryPayload si no lo tienes
import type { WorkdayIssue } from "../types/workdayIssue";

// Ya existente
export const sendPartialClosure = async (
  data: PartialSummaryPayload,
  token: string
) => {
  const res = await axios.post("/workday-summary/partial", data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// 🆕 Nuevo: cierre final
export const sendFinalClosure = async (
  data: FinalSummaryPayload,
  token: string
) => {
  const res = await axios.post("/workday-summary", data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const getAllSummaries = async (token: string): Promise<WorkdaySummary[]> => {
  const res = await axios.get("/workday-summary", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const getAllIssueReports = async (token: string): Promise<WorkdayIssue[]> => {
  const res = await fetch("/api/workday-summary/issues", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error("Error al obtener reportes técnicos");
  return res.json();
};

// 🆕 Borrar un reporte de avería por ID (usando axios)
export const deleteIssueReport = async (token: string, id: string): Promise<void> => {
  await axios.delete(`/workday-summary/issues/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

/* =========================
   NUEVO: contador pendientes (Summaries)
   ========================= */

interface SummariesCountResponse {
  count: number;
}

/**
 * Devuelve el número de summaries con el estado indicado (por defecto: 'pending').
 * Llama a GET /workday-summary/count?status=<status> y retorna un number.
 * Nota: el backend acepta 'pending' y puede mapear a reviewStatus/isReviewed.
 */
export const getSummariesPendingCount = async (
  token: string,
  status: string = "pending"
): Promise<number> => {
  try {
    const res = await axios.get<SummariesCountResponse>("/workday-summary/count", {
      params: { status },
      headers: { Authorization: `Bearer ${token}` },
    });
    return typeof res.data?.count === "number" ? res.data.count : 0;
  } catch (err: any) {
    const msg =
      err?.response?.data?.message ||
      err?.message ||
      "Error al obtener el contador de summaries pendientes";
    throw new Error(msg);
  }
};
