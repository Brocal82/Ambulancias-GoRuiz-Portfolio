import axiosInstance from "../../../api/axios";

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
  /** Nombres canónicos o alias por empresa; el backend resuelve (p. ej. autoid → vehicle). */
  cellLineOrder: string[];
  nameMatching?: "employee_number_only" | "employee_number_then_name";
  normalizeEmployeeNumber?: "trim" | "trim_strip_leading_zeros";
  /** Mismas claves que en GET /me → cardLayout. */
  workerCardLayout?: {
    dayDateField: string;
    timeField: string;
    vehicleField: string;
    driverField: string;
    medicField: string;
  };
  /** Nombres propios (Excel / jerga) por parte de ficha, solo referencia en admin. */
  workerCardLineNameHints?: {
    dayDateField?: string;
    timeField?: string;
    vehicleField?: string;
    driverField?: string;
    medicField?: string;
  };
}

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
    Array<{
      weekStart: string;
      publishedAt?: string;
      sourceFileUrl?: string;
      sourceStoredFilename?: string;
    }>
  >("/api/excel-planning/weeks");
  return data;
}

export async function getMyExcelPlanningWeek(weekStart?: string) {
  const { data } = await axiosInstance.get<{
    weekStart: string;
    rows: ExcelPlanRow[];
    published: boolean;
    sourceFileUrl?: string;
    cardLayout?: {
      dayDateField: string;
      timeField: string;
      vehicleField: string;
      driverField: string;
      medicField: string;
    };
  }>("/api/excel-planning/me", {
    params: weekStart ? { weekStart } : undefined,
  });
  return data;
}
