// frontend/src/api/workdaySummary.ts
import axios from "./axios";
import type { PartialSummaryPayload, FinalSummaryPayload, WorkdaySummary } from "../types/workdaySummary"; // añade FinalSummaryPayload si no lo tienes

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
