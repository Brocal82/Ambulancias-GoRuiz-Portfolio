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