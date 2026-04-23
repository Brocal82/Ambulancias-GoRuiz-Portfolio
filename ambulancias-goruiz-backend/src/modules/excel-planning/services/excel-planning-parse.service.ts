import * as XLSX from "xlsx";
import { setISOWeek, startOfISOWeek } from "date-fns";
import {
  type ExcelPlanningMapping,
  resolveCellLineRoleToCanonical,
} from "../schemas/excel-planning.schemas";
import type { IExcelPlanRow } from "../models/excel-planning-import.model";

export interface ParseExcelResult {
  weekStartDetected: Date | null;
  parseErrors: string[];
  rows: Omit<IExcelPlanRow, "matchedUserId" | "matchMethod" | "matchWarning">[];
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/** YYYY-MM-DD → Date UTC medianoche */
export function parseIsoDateUtc(ymd: string): Date | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Alinea con la exportación (`buildExcelBufferFromPlanRows`): lunes de la semana ISO (UTC) para un YYYY-MM-DD.
 * Si se indica un martes, se guarda el lunes de esa semana.
 */
export function normalizeYmdToIsoWeekMondayUtc(ymd: string): Date | null {
  const d = parseIsoDateUtc(ymd);
  if (!d) return null;
  const monday = startOfISOWeek(d);
  return new Date(
    Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()),
  );
}

export function normalizeDateToIsoWeekMondayUtc(d: Date): Date {
  const monday = startOfISOWeek(d);
  return new Date(
    Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()),
  );
}

/**
 * A partir de un texto de celda (KW, fecha ISO, etc.) intenta obtener el lunes UTC de esa semana ISO.
 */
export function parseWeekStartFromCellText(raw: string): Date | null {
  const text = raw.trim();
  if (!text) return null;

  const isoKw = text.match(/KW\s*(\d{1,2})\s*[/\s.-]\s*(\d{4})/i);
  if (isoKw) {
    const week = parseInt(isoKw[1], 10);
    const year = parseInt(isoKw[2], 10);
    if (week < 1 || week > 53 || year < 1970 || year > 2100) return null;
    const ref = new Date(year, 0, 4);
    const withWeek = setISOWeek(ref, week);
    const monday = startOfISOWeek(withWeek);
    return new Date(
      Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()),
    );
  }

  const isoDate = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDate) {
    const d = parseIsoDateUtc(isoDate[1]);
    if (d) {
      const monday = startOfISOWeek(d);
      return new Date(
        Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()),
      );
    }
  }

  const t = Date.parse(text);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    const monday = startOfISOWeek(d);
    return new Date(
      Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()),
    );
  }

  return null;
}

/**
 * Plantillas antiguas: employeeNumber → partnerEmployeeNumber → name → partnerName.
 * Con 5 líneas en la celda, el nombre principal quedaba en partnerEmployeeNumber y no había compañero.
 * Orden soportado: … name → partnerName → partnerEmployeeNumber (opcional).
 */
export function migrateLegacyCellLineOrder(
  order: ExcelPlanningMapping["cellLineOrder"],
): ExcelPlanningMapping["cellLineOrder"] {
  const canon = order.map((r) => resolveCellLineRoleToCanonical(r)!);
  const peIdx = canon.indexOf("partnerEmployeeNumber");
  const nameIdx = canon.indexOf("name");
  if (peIdx === -1 || nameIdx === -1 || peIdx >= nameIdx) {
    return order;
  }
  const without = order.filter(
    (_r, i) => canon[i] !== "partnerEmployeeNumber",
  );
  const withoutCanon = without.map((r) => resolveCellLineRoleToCanonical(r)!);
  const pnIdx = withoutCanon.indexOf("partnerName");
  const nameIdx2 = withoutCanon.indexOf("name");
  const insertAt =
    pnIdx >= 0 ? pnIdx + 1 : nameIdx2 >= 0 ? nameIdx2 + 1 : without.length;
  const out: ExcelPlanningMapping["cellLineOrder"] = [...without];
  out.splice(insertAt, 0, "partnerEmployeeNumber");
  return out;
}

/**
 * Dos nº en la misma línea del Excel (p. ej. "0001 / 0002") para que ambos se vean en la cuadrícula.
 * Solo aplica si aún no hay partnerEmployeeNumber en su línea propia.
 */
function splitDualEmployeeNumberLine(raw: string): {
  primary: string;
  partner?: string;
} {
  const t = raw.trim();
  if (!t) return { primary: "" };
  const parts = t.split(/\s*[/+&,，]\s*/).map((s) => s.trim()).filter(Boolean);
  const digitToken = (s: string) => {
    const x = s.replace(/\s/g, "");
    return x.length > 0 && /^\d+$/.test(x);
  };
  if (parts.length === 2 && digitToken(parts[0]) && digitToken(parts[1])) {
    return { primary: parts[0], partner: parts[1] };
  }
  return { primary: t };
}

function normalizeEmployeeNumber(
  raw: string,
  mode: ExcelPlanningMapping["normalizeEmployeeNumber"],
): string {
  let s = raw.trim();
  if (mode === "trim_strip_leading_zeros") {
    const stripped = s.replace(/^0+/, "");
    s = stripped.length > 0 ? stripped : "0";
  }
  return s;
}

function mapLinesToFields(
  lines: string[],
  order: ExcelPlanningMapping["cellLineOrder"],
): {
  timeText?: string;
  vehicleCode?: string;
  employeeNumber?: string;
  partnerEmployeeNumber?: string;
  displayNameFromExcel?: string;
  displayPartnerNameFromExcel?: string;
} {
  const out: {
    timeText?: string;
    vehicleCode?: string;
    employeeNumber?: string;
    partnerEmployeeNumber?: string;
    displayNameFromExcel?: string;
    displayPartnerNameFromExcel?: string;
  } = {};
  for (let i = 0; i < order.length; i++) {
    const role = resolveCellLineRoleToCanonical(order[i])!;
    const line = lines[i]?.trim() ?? "";
    if (role === "ignore" || !line) continue;
    if (role === "time") out.timeText = line;
    else if (role === "vehicle") out.vehicleCode = line;
    else if (role === "employeeNumber") out.employeeNumber = line;
    else if (role === "partnerEmployeeNumber") out.partnerEmployeeNumber = line;
    else if (role === "name") {
      out.displayNameFromExcel = out.displayNameFromExcel
        ? `${out.displayNameFromExcel} ${line}`
        : line;
    } else if (role === "partnerName") {
      out.displayPartnerNameFromExcel = out.displayPartnerNameFromExcel
        ? `${out.displayPartnerNameFromExcel} ${line}`
        : line;
    }
  }
  return out;
}

function addDaysUtc(monday: Date, dayIndex: number): Date {
  const d = new Date(monday);
  d.setUTCDate(d.getUTCDate() + dayIndex);
  return d;
}

export function parseExcelBuffer(
  buffer: Buffer,
  mapping: ExcelPlanningMapping,
): ParseExcelResult {
  const parseErrors: string[] = [];
  const rows: ParseExcelResult["rows"] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    return {
      weekStartDetected: null,
      parseErrors: ["No se pudo leer el archivo Excel."],
      rows: [],
    };
  }

  const sheetName =
    workbook.SheetNames[mapping.sheetIndex] ?? workbook.SheetNames[0];
  if (!sheetName) {
    return {
      weekStartDetected: null,
      parseErrors: ["El libro no contiene hojas."],
      rows: [],
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const grid = XLSX.utils.sheet_to_json<(string | number | boolean | Date)[]>(
    sheet,
    { header: 1, defval: "" },
  ) as unknown[][];

  let weekStartDetected: Date | null = null;
  if (mapping.weekCell) {
    const { row, col } = mapping.weekCell;
    const cellRaw = grid[row]?.[col];
    const cellText = cellToString(cellRaw);
    weekStartDetected = parseWeekStartFromCellText(cellText);
    if (mapping.requireWeekFromSheet && !weekStartDetected) {
      parseErrors.push(
        "No se pudo determinar la semana desde la celda configurada. Indique weekStart al publicar o ajuste weekCell.",
      );
    }
  }

  const monday = weekStartDetected;
  if (!monday && mapping.requireWeekFromSheet) {
    return { weekStartDetected: null, parseErrors, rows: [] };
  }

  /** Si aún no hay semana, usamos filas sin dayDate real (placeholder); el servicio de import rellenará al publicar. */
  const effectiveMonday =
    monday ?? new Date(Date.UTC(1970, 0, 5, 0, 0, 0, 0)); // lunes dummy; se reemplaza al publicar

  const endRow =
    mapping.dataEndRow !== undefined
      ? mapping.dataEndRow
      : grid.length - 1;

  const cellLineOrder = migrateLegacyCellLineOrder(mapping.cellLineOrder);

  for (let r = mapping.dataStartRow; r <= endRow; r++) {
    const rowArr = grid[r];
    if (!rowArr) break;

    const dienstRaw = cellToString(rowArr[mapping.dienstNumberColumn]);
    const dienstNumber = dienstRaw.trim();
    if (!dienstNumber) {
      if (mapping.dataEndRow === undefined) break;
      continue;
    }

    const rowLabel =
      mapping.rowLabelColumn !== undefined
        ? cellToString(rowArr[mapping.rowLabelColumn]).trim() || undefined
        : undefined;

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const col = mapping.dayColumns[dayIndex];
      const cellVal = rowArr[col];
      const rawCellText = cellToString(cellVal).trim();
      if (!rawCellText) continue;

      const lines = rawCellText
        .split(mapping.lineDelimiter)
        .map((l) => l.trim());

      const fields = mapLinesToFields(lines, cellLineOrder);
      let empRaw = fields.employeeNumber?.trim() ?? "";
      let partnerEmpRaw = fields.partnerEmployeeNumber?.trim() ?? "";
      const dual = splitDualEmployeeNumberLine(empRaw);
      if (dual.partner) {
        empRaw = dual.primary;
        if (!partnerEmpRaw) partnerEmpRaw = dual.partner;
      }
      const employeeNumberNorm = empRaw
        ? normalizeEmployeeNumber(empRaw, mapping.normalizeEmployeeNumber)
        : undefined;
      const partnerEmployeeNumberNorm = partnerEmpRaw
        ? normalizeEmployeeNumber(partnerEmpRaw, mapping.normalizeEmployeeNumber)
        : undefined;

      rows.push({
        dayIndex,
        dayDate: addDaysUtc(effectiveMonday, dayIndex),
        dienstNumber,
        rowLabel,
        timeText: fields.timeText,
        vehicleCode: fields.vehicleCode,
        employeeNumber: employeeNumberNorm,
        partnerEmployeeNumber: partnerEmployeeNumberNorm,
        displayNameFromExcel: fields.displayNameFromExcel,
        displayPartnerNameFromExcel: fields.displayPartnerNameFromExcel,
        rawCellText,
      });
    }
  }

  return { weekStartDetected, parseErrors, rows };
}
