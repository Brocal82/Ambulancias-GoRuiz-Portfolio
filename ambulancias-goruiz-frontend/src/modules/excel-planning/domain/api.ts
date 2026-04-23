import axiosInstance from "../../../api/axios";
import { isAxiosError } from "axios";

export interface ExcelPlanningMapping {
  sheetIndex: number;
  weekCell?: { row: number; col: number };
  requireWeekFromSheet?: boolean;
  dataStartRow: number;
  dataEndRow?: number;
  dienstNumberColumn: number;
  rowLabelColumn?: number;
  dayColumns: [number, number, number, number, number, number, number];
  lineDelimiter?: string;
  cellLineOrder: Array<
    | "time"
    | "vehicle"
    | "employeeNumber"
    | "partnerEmployeeNumber"
    | "name"
    | "partnerName"
    | "ignore"
  >;
  nameMatching?: "employee_number_only" | "employee_number_then_name";
  normalizeEmployeeNumber?: "trim" | "trim_strip_leading_zeros";
}

/** Cuerpo de POST /export (sin campos de match del import). */
export type ExcelExportRow = {
  dayIndex?: number;
  dayDate?: string;
  dienstNumber: string;
  rowLabel?: string;
  timeText?: string;
  vehicleCode?: string;
  employeeNumber?: string;
  partnerEmployeeNumber?: string;
  displayNameFromExcel?: string;
  displayPartnerNameFromExcel?: string;
};

export interface ExcelPlanRow {
  dayIndex: number;
  dayDate: string;
  dienstNumber: string;
  rowLabel?: string;
  timeText?: string;
  vehicleCode?: string;
  employeeNumber?: string;
  partnerEmployeeNumber?: string;
  displayNameFromExcel?: string;
  displayPartnerNameFromExcel?: string;
  rawCellText: string;
  matchedUserId?: string;
  matchedPartnerUserId?: string;
  matchMethod: "employee_number" | "name_auto" | "none";
  matchWarning?: string;
  /** Perfil del trabajador principal (solo respuesta /me publicada). */
  primaryAmbulanceRole?: "driver" | "medic" | "both";
  /** Perfil del compañero (solo respuesta /me publicada). */
  partnerAmbulanceRole?: "driver" | "medic" | "both";
}

export async function getExcelPlanningTemplate() {
  const { data } = await axiosInstance.get<{
    _id?: string;
    name?: string;
    mapping: ExcelPlanningMapping;
  } | null>("/api/excel-planning/template");
  return data;
}

export async function putExcelPlanningTemplate(body: {
  name?: string;
  mapping: ExcelPlanningMapping;
}) {
  const { data } = await axiosInstance.put("/api/excel-planning/template", body);
  return data;
}

export async function postExcelPlanningExport(body: {
  weekStart: string;
  rows: ExcelExportRow[];
}): Promise<{ blob: Blob; filename: string }> {
  try {
    const res = await axiosInstance.post<Blob>("/api/excel-planning/export", body, {
      responseType: "blob",
    });
    const cd = res.headers["content-disposition"];
    let filename = "excel-planning.xlsx";
    const m = typeof cd === "string" ? /filename="([^"]+)"/i.exec(cd) : null;
    if (m?.[1]) filename = m[1];
    return { blob: res.data, filename };
  } catch (e: unknown) {
    if (isAxiosError(e) && e.response?.data instanceof Blob) {
      const text = await e.response.data.text();
      let msg = text || "Error al exportar";
      try {
        const j = JSON.parse(text) as { message?: string };
        if (j.message) msg = j.message;
      } catch {
        /* mantener msg */
      }
      throw new Error(msg);
    }
    throw e;
  }
}

export async function postExcelPlanningImport(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await axiosInstance.post("/api/excel-planning/imports", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data as {
    _id: string;
    parseErrors: string[];
    previewRows: ExcelPlanRow[];
    stats?: {
      totalCells: number;
      matchedByNumber: number;
      matchedByName: number;
      unmatched: number;
      numberKeyCollisions?: number;
      collidingKeysSample?: string[];
    };
    weekStartDetected?: string;
    fileUrl?: string;
  };
}

export async function getExcelPlanningImport(id: string) {
  const { data } = await axiosInstance.get(`/api/excel-planning/imports/${id}`);
  return data as {
    _id: string;
    parseErrors: string[];
    previewRows: ExcelPlanRow[];
    stats?: Record<string, number>;
    weekStartDetected?: string;
    fileUrl?: string;
    status: string;
  };
}

export async function publishExcelPlanningImport(
  id: string,
  body: { weekStart?: string },
) {
  const { data } = await axiosInstance.post(
    `/api/excel-planning/imports/${id}/publish`,
    body,
  );
  return data;
}

export async function listExcelPlanningWeeks() {
  const { data } = await axiosInstance.get<
    Array<{ weekStart: string; publishedAt?: string; sourceFileUrl?: string }>
  >("/api/excel-planning/weeks");
  return data;
}

export async function getMyExcelPlanningWeek(weekStart?: string) {
  const { data } = await axiosInstance.get<{
    weekStart: string;
    rows: ExcelPlanRow[];
    published: boolean;
    sourceFileUrl?: string;
  }>("/api/excel-planning/me", {
    params: weekStart ? { weekStart } : undefined,
  });
  return data;
}
