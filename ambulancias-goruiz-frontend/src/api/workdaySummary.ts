// frontend/src/api/workdaySummary.ts
import axios from "./axios";               // ← usa tu wrapper axios si lo tienes
import type { PartialSummaryPayload } from "../types/workdaySummary"; // ⬅️ importa el tipo

export const sendPartialClosure = async (
  data: PartialSummaryPayload,
  token: string
) => {
  const res = await axios.post("/workday-summary/partial", data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};
