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

const MAX_MECHANICS_PHOTOS = 5;

/**
 * Envía avería: JSON si no hay fotos; multipart si hay adjuntos (campo `photos`, solo imágenes).
 */
export const reportIssue = async (
  payload: ReportIssuePayload,
  photos?: File[],
): Promise<void> => {
  const files = (photos ?? []).filter(Boolean).slice(0, MAX_MECHANICS_PHOTOS);
  if (files.length === 0) {
    await axios.post("/mechanics/report-issue", payload);
    return;
  }
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    form.append(key, String(value));
  }
  for (const file of files) {
    form.append("photos", file);
  }
  await axios.post("/mechanics/report-issue", form);
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
