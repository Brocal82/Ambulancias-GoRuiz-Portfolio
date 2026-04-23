import * as XLSX from "xlsx";
import {
  type ExcelPlanningMapping,
  resolveCellLineRoleToCanonical,
} from "../schemas/excel-planning.schemas";
import { parseIsoDateUtc, normalizeYmdToIsoWeekMondayUtc } from "./excel-planning-parse.service";

export type ExcelExportInputRow = {
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

function mondayYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function dayIndexInWeek(monday: Date, ymd: string): number | null {
  const d = parseIsoDateUtc(ymd);
  if (!d) return null;
  const diffMs = d.getTime() - monday.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 0 || diffDays > 6) return null;
  return diffDays;
}

type LineFields = {
  timeText?: string;
  vehicleCode?: string;
  employeeNumber?: string;
  partnerEmployeeNumber?: string;
  displayNameFromExcel?: string;
  displayPartnerNameFromExcel?: string;
};

function buildMultilineCell(
  mapping: ExcelPlanningMapping,
  fields: LineFields,
): string {
  const delim = mapping.lineDelimiter ?? "\n";
  const parts: string[] = [];
  for (const roleRaw of mapping.cellLineOrder) {
    const role = resolveCellLineRoleToCanonical(roleRaw)!;
    if (role === "ignore") {
      parts.push("");
      continue;
    }
    let v = "";
    switch (role) {
      case "time":
        v = fields.timeText?.trim() ?? "";
        break;
      case "vehicle":
        v = fields.vehicleCode?.trim() ?? "";
        break;
      case "employeeNumber":
        v = fields.employeeNumber?.trim() ?? "";
        break;
      case "partnerEmployeeNumber":
        v = fields.partnerEmployeeNumber?.trim() ?? "";
        break;
      case "name":
        v = fields.displayNameFromExcel?.trim() ?? "";
        break;
      case "partnerName":
        v = fields.displayPartnerNameFromExcel?.trim() ?? "";
        break;
      default:
        break;
    }
    parts.push(v);
  }
  return parts.join(delim);
}

function cellHasAnyValue(text: string, delim: string): boolean {
  return text.split(delim).some((p) => p.trim().length > 0);
}

function sortRowKeys(keys: string[]): string[] {
  const parsed = keys.map((k) => {
    const tabIdx = k.indexOf("\t");
    const dn = tabIdx === -1 ? k : k.slice(0, tabIdx);
    const rl = tabIdx === -1 ? "" : k.slice(tabIdx + 1);
    return { k, dn, rl };
  });
  parsed.sort((a, b) => {
    const na = parseInt(a.dn, 10);
    const nb = parseInt(b.dn, 10);
    const aN = Number.isFinite(na);
    const bN = Number.isFinite(nb);
    if (aN && bN && na !== nb) return na - nb;
    const c = a.dn.localeCompare(b.dn, undefined, { numeric: true });
    if (c !== 0) return c;
    return a.rl.localeCompare(b.rl);
  });
  return parsed.map((p) => p.k);
}

/**
 * Genera un libro Excel alineado con el mismo `mapping` que usa el import
 * (filas de datos, columnas de día, líneas por celda).
 */
export function buildExcelBufferFromPlanRows(
  mapping: ExcelPlanningMapping,
  weekStartYmd: string,
  inputRows: ExcelExportInputRow[],
): { buffer: Buffer; filename: string } {
  const monday = normalizeYmdToIsoWeekMondayUtc(weekStartYmd);
  if (!monday) {
    throw new Error("weekStart inválido (use YYYY-MM-DD).");
  }

  const resolved: Array<ExcelExportInputRow & { dayIndex: number }> = [];
  for (const r of inputRows) {
    let dayIndex: number | undefined = r.dayIndex;
    if (dayIndex === undefined && r.dayDate) {
      const di = dayIndexInWeek(monday, r.dayDate);
      if (di === null) {
        throw new Error(
          `dayDate "${r.dayDate}" no cae en la semana del lunes ${mondayYmd(monday)}.`,
        );
      }
      dayIndex = di;
    }
    if (dayIndex === undefined || dayIndex < 0 || dayIndex > 6) {
      throw new Error(
        "Cada fila necesita dayIndex (0=lunes … 6=domingo) o dayDate en esa semana.",
      );
    }
    resolved.push({ ...r, dayIndex });
  }

  const cellMap = new Map<string, Map<number, LineFields>>();
  const rowKeysSet = new Set<string>();

  for (const r of resolved) {
    const rowKey = `${r.dienstNumber.trim()}\t${r.rowLabel?.trim() ?? ""}`;
    rowKeysSet.add(rowKey);
    if (!cellMap.has(rowKey)) cellMap.set(rowKey, new Map());
    const byDay = cellMap.get(rowKey)!;
    byDay.set(r.dayIndex, {
      timeText: r.timeText,
      vehicleCode: r.vehicleCode,
      employeeNumber: r.employeeNumber,
      partnerEmployeeNumber: r.partnerEmployeeNumber,
      displayNameFromExcel: r.displayNameFromExcel,
      displayPartnerNameFromExcel: r.displayPartnerNameFromExcel,
    });
  }

  const sortedKeys = sortRowKeys([...rowKeysSet]);
  const rowKeyToSheetRow = new Map<string, number>();
  sortedKeys.forEach((key, i) => {
    rowKeyToSheetRow.set(key, mapping.dataStartRow + i);
  });

  const lastDataRow = mapping.dataStartRow + sortedKeys.length - 1;
  let nRows = lastDataRow + 1;
  if (mapping.weekCell && mapping.weekCell.row + 1 > nRows) {
    nRows = mapping.weekCell.row + 1;
  }

  const nCols =
    Math.max(
      mapping.dienstNumberColumn,
      mapping.rowLabelColumn ?? -1,
      ...mapping.dayColumns,
      mapping.weekCell?.col ?? -1,
    ) + 1;

  const grid: string[][] = [];
  for (let r = 0; r < nRows; r++) {
    grid[r] = Array(nCols).fill("");
  }

  const mondayStr = mondayYmd(monday);

  if (mapping.weekCell) {
    grid[mapping.weekCell.row][mapping.weekCell.col] = mondayStr;
  }

  const delim = mapping.lineDelimiter ?? "\n";

  for (const key of sortedKeys) {
    const sheetRow = rowKeyToSheetRow.get(key)!;
    const tabIdx = key.indexOf("\t");
    const dienstNumber = tabIdx === -1 ? key : key.slice(0, tabIdx);
    const rowLabel = tabIdx === -1 ? "" : key.slice(tabIdx + 1);
    grid[sheetRow][mapping.dienstNumberColumn] = dienstNumber;
    if (mapping.rowLabelColumn !== undefined) {
      grid[sheetRow][mapping.rowLabelColumn] = rowLabel;
    }
    const byDay = cellMap.get(key)!;
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const fields = byDay.get(dayIndex);
      if (!fields) continue;
      const text = buildMultilineCell(mapping, fields);
      if (!cellHasAnyValue(text, delim)) continue;
      const col = mapping.dayColumns[dayIndex];
      grid[sheetRow][col] = text;
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(grid);
  const baseName = "Plan";
  XLSX.utils.book_append_sheet(wb, ws, baseName.slice(0, 31));
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const filename = `excel-planning-${mondayStr}.xlsx`;
  return { buffer, filename };
}
