import axios from "../../../api/axios";
import type {
  PartialSummaryPayload,
  FinalSummaryPayload,
  WorkdaySummary,
} from "./types/workdaySummary";
/* =========================
   EXISTENTES
   ========================= */

export const sendPartialClosure = async (data: PartialSummaryPayload) => {
  const res = await axios.post("/workday-summary/partial", data);
  return res.data;
};

export const sendFinalClosure = async (data: FinalSummaryPayload) => {
  const res = await axios.post("/workday-summary", data);
  return res.data;
};

export const getAllSummaries = async (): Promise<WorkdaySummary[]> => {
  const res = await axios.get("/workday-summary");
  return res.data;
};

interface SummariesCountResponse {
  count: number;
}

export const getSummariesPendingCount = async (
  status: string = "pending",
): Promise<number> => {
  try {
    const res = await axios.get<SummariesCountResponse>(
      "/workday-summary/count",
      {
        params: { status },
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
  id: string,
): Promise<WorkdaySummary> => {
  try {
    const res = await axios.patch(`/workday-summary/${id}/review`, null);
    return res.data as WorkdaySummary;
  } catch (err: any) {
    const msg =
      err?.response?.data?.message ||
      err?.message ||
      "Error al marcar el resumen como revisado";
    throw new Error(msg);
  }
};
