import axios from "../../../api/axios";
import type {
  PartialSummaryPayload,
  FinalSummaryPayload,
  WorkdaySummary,
} from "./types/workdaySummary";;
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
