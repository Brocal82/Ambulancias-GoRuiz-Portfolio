import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import User from "../../users/models/user.model";
import ExcelPlanningTemplate from "../models/excel-planning-template.model";
import ExcelPlanningImport, {
  type IExcelPlanningImport,
  type IExcelPlanRow,
} from "../models/excel-planning-import.model";
import ExcelPlanningWeek from "../models/excel-planning-week.model";
import {
  excelPlanningMappingSchema,
  workerCardLayoutSchema,
  type WorkerCardLayout,
} from "../schemas/excel-planning.schemas";
import type {
  ExcelPlanningMapping,
  PutExcelPlanningTemplateBody,
  PublishExcelImportBody,
  PostExcelExportBody,
} from "../schemas/excel-planning.schemas";
import {
  migrateLegacyCellLineOrder,
  normalizeDateToIsoWeekMondayUtc,
  normalizeYmdToIsoWeekMondayUtc,
  parseExcelBuffer,
  parseIsoDateUtc,
  splitDualEmployeeNumberLine,
} from "./excel-planning-parse.service";
import { buildExcelBufferFromPlanRows } from "./excel-planning-export.service";
import { requireCompanyForAdmin, requireCompanyForWorker } from "../../../utils/requireCompany";
import type { Request } from "express";

const uploadDir = path.join(__dirname, "../../../../uploads");

function addDaysUtc(monday: Date, dayIndex: number): Date {
  const d = new Date(monday);
  d.setUTCDate(d.getUTCDate() + dayIndex);
  return d;
}

function remapRowDates(rows: IExcelPlanRow[], weekStart: Date): void {
  for (const row of rows) {
    row.dayDate = addDaysUtc(weekStart, row.dayIndex);
  }
}

function normalizeEmpKey(
  raw: string | undefined,
  mode: ExcelPlanningMapping["normalizeEmployeeNumber"],
): string {
  if (!raw) return "";
  let s = raw.trim();
  if (mode === "trim_strip_leading_zeros") {
    const stripped = s.replace(/^0+/, "");
    s = stripped.length > 0 ? stripped : "0";
  }
  return s;
}

/** Importes antiguos guardaban dayDate placeholder (1970) si la semana no se detectó en la hoja. */
function fixRowDayDateIfLegacy(row: IExcelPlanRow, weekStart: Date): IExcelPlanRow {
  const d = new Date(row.dayDate as unknown as string);
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 2000) {
    return { ...row, dayDate: addDaysUtc(weekStart, row.dayIndex) };
  }
  return row;
}

/** Pareja: línea explícita o "0001/0002" en la misma celda. */
function partnerRawForRematch(row: IExcelPlanRow): string | undefined {
  const p = row.partnerEmployeeNumber?.trim();
  if (p) return p;
  const e = row.employeeNumber?.trim();
  if (!e) return undefined;
  const { partner } = splitDualEmployeeNumberLine(e);
  return partner;
}

/**
 * Fila pública en la que aún faltó matchedPartnerUserId; al leer, resolvemos p. nº de compañero.
 */
function resolvePartnerUserIdStringForRead(
  row: IExcelPlanRow,
  byNumber: Map<string, CompanyUserLite>,
  normalizeMode: "trim" | "trim_strip_leading_zeros",
): string | undefined {
  if (row.matchedPartnerUserId) {
    return String(row.matchedPartnerUserId);
  }
  const pRaw = partnerRawForRematch(row);
  if (!pRaw) return undefined;
  const hit = lookupWorkerByEmployeeKeys(
    pRaw,
    byNumber,
    normalizeMode,
  );
  if (!hit) return undefined;
  if (row.matchedUserId && String(hit._id) === String(row.matchedUserId)) {
    return undefined;
  }
  return String(hit._id);
}

function addEmployeeNumberAlias(
  byNumber: Map<string, CompanyUserLite>,
  collisionKeys: Set<string>,
  key: string,
  u: CompanyUserLite,
): void {
  if (!key) return;
  const existing = byNumber.get(key);
  if (existing && String(existing._id) !== String(u._id)) {
    collisionKeys.add(key);
    return;
  }
  if (!existing) {
    byNumber.set(key, u);
  }
}

function lookupWorkerByEmployeeKeys(
  rowEmp: string | undefined,
  byNumber: Map<string, CompanyUserLite>,
  primaryMode: ExcelPlanningMapping["normalizeEmployeeNumber"],
): CompanyUserLite | undefined {
  if (!rowEmp?.trim()) return undefined;
  const keys = [
    normalizeEmpKey(rowEmp, primaryMode),
    normalizeEmpKey(rowEmp, "trim"),
    normalizeEmpKey(rowEmp, "trim_strip_leading_zeros"),
  ];
  const seen = new Set<string>();
  for (const k of keys) {
    if (!k || seen.has(k)) continue;
    seen.add(k);
    const hit = byNumber.get(k);
    if (hit) return hit;
  }
  return undefined;
}

interface CompanyUserLite {
  _id: mongoose.Types.ObjectId;
  employeeNumber?: string;
  name?: string;
  lastName?: string;
  ambulanceRole?: "driver" | "medic" | "both";
}

async function buildEmployeeMaps(
  companyId: mongoose.Types.ObjectId,
  mapping: ExcelPlanningMapping,
): Promise<{
  byNumber: Map<string, CompanyUserLite>;
  nameAutoCandidates: CompanyUserLite[];
  numberKeyCollisions: string[];
}> {
  const users = await User.find({
    companyId,
    role: "worker",
    isActive: { $ne: false },
  })
    .select("employeeNumber name lastName ambulanceRole")
    .lean<CompanyUserLite[]>();

  const byNumber = new Map<string, CompanyUserLite>();
  const collisionKeys = new Set<string>();
  const nameAutoCandidates: CompanyUserLite[] = [];

  for (const u of users) {
    if (u.employeeNumber?.trim()) {
      const t = normalizeEmpKey(u.employeeNumber, "trim");
      const z = normalizeEmpKey(u.employeeNumber, "trim_strip_leading_zeros");
      addEmployeeNumberAlias(byNumber, collisionKeys, t, u);
      if (z !== t) {
        addEmployeeNumberAlias(byNumber, collisionKeys, z, u);
      }
    }
    nameAutoCandidates.push(u);
  }

  return {
    byNumber,
    nameAutoCandidates,
    numberKeyCollisions: [...collisionKeys].sort(),
  };
}

function normalizeNameToken(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Coincidencia conservadora por nombre: solo si hay exactamente un usuario compatible. */
function tryUniqueNameMatch(
  displayName: string | undefined,
  candidates: CompanyUserLite[],
): CompanyUserLite | null {
  if (!displayName?.trim()) return null;
  const needle = normalizeNameToken(displayName);
  if (needle.length < 2) return null;

  const matches: CompanyUserLite[] = [];
  for (const u of candidates) {
    const full = normalizeNameToken(`${u.lastName ?? ""} ${u.name ?? ""}`);
    const rev = normalizeNameToken(`${u.name ?? ""} ${u.lastName ?? ""}`);
    if (
      (full.length > 0 && needle.includes(full)) ||
      (rev.length > 0 && needle.includes(rev)) ||
      (full.length > 0 && full.includes(needle)) ||
      (rev.length > 0 && rev.includes(needle))
    ) {
      matches.push(u);
    }
  }
  if (matches.length === 1) return matches[0] ?? null;
  return null;
}

function excelStyleLabel(u: CompanyUserLite): string {
  const ln = (u.lastName ?? "").trim();
  const n = (u.name ?? "").trim();
  if (ln && n) return `${ln}, ${n}`;
  return ln || n || "—";
}

function applyMatching(
  rows: IExcelPlanRow[],
  mapping: ExcelPlanningMapping,
  byNumber: Map<string, CompanyUserLite>,
  nameCandidates: CompanyUserLite[],
): NonNullable<import("../models/excel-planning-import.model").IExcelPlanningImport["stats"]> {
  let matchedByNumber = 0;
  let matchedByName = 0;
  let unmatched = 0;

  for (const row of rows) {
    row.matchMethod = "none";
    row.matchedUserId = undefined;
    row.matchedPartnerUserId = undefined;
    row.matchWarning = undefined;

    const hitNum = lookupWorkerByEmployeeKeys(
      row.employeeNumber,
      byNumber,
      mapping.normalizeEmployeeNumber,
    );

    let primaryByName: CompanyUserLite | null = null;
    if (mapping.nameMatching === "employee_number_then_name") {
      primaryByName = tryUniqueNameMatch(row.displayNameFromExcel, nameCandidates);
    }

    if (hitNum) {
      row.matchedUserId = hitNum._id;
      row.matchMethod = "employee_number";
      matchedByNumber++;
      row.displayNameFromExcel = excelStyleLabel(hitNum);
    } else if (primaryByName) {
      row.matchedUserId = primaryByName._id;
      row.matchMethod = "name_auto";
      matchedByName++;
      row.displayNameFromExcel = excelStyleLabel(primaryByName);
    }

    if (
      mapping.nameMatching === "employee_number_only" &&
      row.employeeNumber?.trim() &&
      !hitNum
    ) {
      row.matchWarning =
        "Número de trabajador del Excel no coincide con ningún trabajador activo de esta empresa.";
    }

    /**
     * Compañero: primero por número de trabajador (si el Excel lo trae en línea propia),
     * luego por nombre único. Permite que el segundo trabajador vea la fila vía matchedPartnerUserId.
     */
    const hitPartnerNum = row.partnerEmployeeNumber?.trim()
      ? lookupWorkerByEmployeeKeys(
          row.partnerEmployeeNumber,
          byNumber,
          mapping.normalizeEmployeeNumber,
        )
      : undefined;

    if (
      mapping.nameMatching === "employee_number_only" &&
      row.partnerEmployeeNumber?.trim() &&
      !hitPartnerNum
    ) {
      const extra =
        "Número de compañero del Excel no coincide con ningún trabajador activo de esta empresa.";
      row.matchWarning = row.matchWarning ? `${row.matchWarning} ${extra}` : extra;
    }

    if (hitPartnerNum) {
      if (
        row.matchedUserId &&
        String(hitPartnerNum._id) === String(row.matchedUserId)
      ) {
        /* mismo usuario duplicado en Excel */
      } else {
        row.matchedPartnerUserId = hitPartnerNum._id;
        row.displayPartnerNameFromExcel = excelStyleLabel(hitPartnerNum);
      }
      if (!row.matchedUserId) {
        row.matchedUserId = hitPartnerNum._id;
        row.matchMethod = "employee_number";
        matchedByNumber++;
      }
    }

    const hitPartnerName =
      !row.matchedPartnerUserId && row.displayPartnerNameFromExcel?.trim()
        ? tryUniqueNameMatch(row.displayPartnerNameFromExcel, nameCandidates)
        : null;
    if (hitPartnerName) {
      if (
        row.matchedUserId &&
        String(hitPartnerName._id) === String(row.matchedUserId)
      ) {
        /* mismo usuario duplicado en Excel */
      } else {
        row.matchedPartnerUserId = hitPartnerName._id;
        row.displayPartnerNameFromExcel = excelStyleLabel(hitPartnerName);
      }
      if (!row.matchedUserId) {
        row.matchedUserId = hitPartnerName._id;
        row.matchMethod = "name_auto";
        matchedByName++;
      }
    }

    if (
      mapping.nameMatching === "employee_number_then_name" &&
      row.displayNameFromExcel?.trim() &&
      !hitNum &&
      !primaryByName
    ) {
      row.matchWarning =
        "Nombre principal sin coincidencia única; use número de trabajador de esta empresa.";
    }
    if (
      row.displayPartnerNameFromExcel?.trim() &&
      !row.matchedPartnerUserId &&
      !hitPartnerNum
    ) {
      const extra =
        "Compañero: sin coincidencia única por nombre entre trabajadores activos de esta empresa.";
      row.matchWarning = row.matchWarning ? `${row.matchWarning} ${extra}` : extra;
    }

    if (!row.matchedUserId) unmatched++;
  }

  return {
    totalCells: rows.length,
    matchedByNumber,
    matchedByName,
    unmatched,
  };
}

export async function getTemplateForAdmin(req: Request) {
  const r = requireCompanyForAdmin(req);
  if (!r.ok) return r;
  const doc = await ExcelPlanningTemplate.findOne({
    companyId: r.companyId,
  }).lean();
  if (!doc) return { ok: true as const, data: null };
  return { ok: true as const, data: doc };
}

export async function exportExcelBufferForAdmin(
  req: Request,
  body: PostExcelExportBody,
) {
  const r = requireCompanyForAdmin(req);
  if (!r.ok) return r;
  const doc = await ExcelPlanningTemplate.findOne({
    companyId: r.companyId,
  }).lean();
  if (!doc?.mapping) {
    return {
      ok: false as const,
      statusCode: 400,
      message: "No hay plantilla Excel. Guarde el mapeo antes de exportar.",
    };
  }
  let mapping: ExcelPlanningMapping;
  try {
    const parsed = excelPlanningMappingSchema.parse(doc.mapping);
    mapping = {
      ...parsed,
      cellLineOrder: migrateLegacyCellLineOrder(parsed.cellLineOrder),
    };
  } catch {
    return {
      ok: false as const,
      statusCode: 400,
      message: "La plantilla guardada no es válida. Revise el JSON de mapeo.",
    };
  }
  try {
    const { buffer, filename } = buildExcelBufferFromPlanRows(
      mapping,
      body.weekStart,
      body.rows,
    );
    return { ok: true as const, buffer, filename };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al generar Excel.";
    return { ok: false as const, statusCode: 400, message: msg };
  }
}

export async function upsertTemplateForAdmin(
  req: Request,
  body: PutExcelPlanningTemplateBody,
) {
  const r = requireCompanyForAdmin(req);
  if (!r.ok) return r;
  const parsed = excelPlanningMappingSchema.parse(body.mapping);
  const mapping: ExcelPlanningMapping = {
    ...parsed,
    cellLineOrder: migrateLegacyCellLineOrder(parsed.cellLineOrder),
  };
  const doc = await ExcelPlanningTemplate.findOneAndUpdate(
    { companyId: r.companyId },
    {
      $set: {
        name: body.name,
        mapping,
        updatedBy: req.userId ? new mongoose.Types.ObjectId(req.userId as string) : undefined,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  return { ok: true as const, data: doc };
}

export async function createImportFromUpload(
  req: Request,
  file: Express.Multer.File | undefined,
) {
  const r = requireCompanyForAdmin(req);
  if (!r.ok) return r;
  if (!file?.filename) {
    return { ok: false as const, statusCode: 400, message: "Falta archivo Excel." };
  }

  const template = await ExcelPlanningTemplate.findOne({
    companyId: r.companyId,
  }).lean();
  if (!template?.mapping) {
    return {
      ok: false as const,
      statusCode: 400,
      message: "Configure primero la plantilla de importación.",
    };
  }

  const mapping = excelPlanningMappingSchema.parse(
    template.mapping as ExcelPlanningMapping,
  );

  const fullPath = path.join(uploadDir, file.filename);
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(fullPath);
  } catch {
    return {
      ok: false as const,
      statusCode: 500,
      message: "No se pudo leer el archivo subido.",
    };
  }

  const parsed = parseExcelBuffer(buffer, mapping);
  const fileUrl = `/uploads/${file.filename}`;

  const { byNumber, nameAutoCandidates, numberKeyCollisions } =
    await buildEmployeeMaps(
      new mongoose.Types.ObjectId(r.companyId),
      mapping,
    );

  const previewRows: IExcelPlanRow[] = parsed.rows.map((row) => ({
    ...row,
    matchMethod: "none",
  }));
  const matchStats = applyMatching(
    previewRows,
    mapping,
    byNumber,
    nameAutoCandidates,
  );
  const stats: NonNullable<IExcelPlanningImport["stats"]> = {
    ...matchStats,
    numberKeyCollisions: numberKeyCollisions.length,
    collidingKeysSample: numberKeyCollisions.slice(0, 12),
  };

  if (parsed.weekStartDetected) {
    remapRowDates(previewRows, parsed.weekStartDetected);
  }

  const imp = await ExcelPlanningImport.create({
    companyId: r.companyId,
    templateId: template._id,
    status: "draft",
    storedFilename: file.filename,
    originalFilename: file.originalname || file.filename,
    fileUrl,
    weekStartDetected: parsed.weekStartDetected ?? undefined,
    parseErrors: parsed.parseErrors,
    previewRows,
    stats,
    createdBy: req.userId
      ? new mongoose.Types.ObjectId(req.userId as string)
      : undefined,
  });

  return {
    ok: true as const,
    data: imp.toObject(),
  };
}

export async function getImportForAdmin(req: Request, importId: string) {
  const r = requireCompanyForAdmin(req);
  if (!r.ok) return r;
  const doc = await ExcelPlanningImport.findOne({
    _id: importId,
    companyId: r.companyId,
  }).lean();
  if (!doc) {
    return { ok: false as const, statusCode: 404, message: "Importación no encontrada." };
  }
  return { ok: true as const, data: doc };
}

export async function publishImportForAdmin(
  req: Request,
  importId: string,
  body: PublishExcelImportBody,
) {
  const r = requireCompanyForAdmin(req);
  if (!r.ok) return r;

  const imp = await ExcelPlanningImport.findOne({
    _id: importId,
    companyId: r.companyId,
    status: "draft",
  });
  if (!imp) {
    return {
      ok: false as const,
      statusCode: 404,
      message: "Importación no encontrada o ya publicada.",
    };
  }

  const template = await ExcelPlanningTemplate.findOne({
    companyId: r.companyId,
  }).lean();
  if (!template?.mapping) {
    return {
      ok: false as const,
      statusCode: 400,
      message: "Plantilla no configurada.",
    };
  }
  const mapping = excelPlanningMappingSchema.parse(
    template.mapping as ExcelPlanningMapping,
  );

  const rowCount = imp.previewRows?.length ?? 0;
  if (rowCount === 0) {
    return {
      ok: false as const,
      statusCode: 400,
      message:
        "No se puede publicar: no hay celdas con datos. Revise el mapeo o vuelva a importar el archivo.",
    };
  }

  const unmatched = imp.stats?.unmatched ?? 0;
  if (unmatched > 0) {
    return {
      ok: false as const,
      statusCode: 400,
      message:
        "No se puede publicar: hay celdas sin asignar a un trabajador. Revise números de empleado o nombres en el directorio, o ajuste el mapeo.",
    };
  }

  const numColl = imp.stats?.numberKeyCollisions ?? 0;
  if (numColl > 0) {
    return {
      ok: false as const,
      statusCode: 400,
      message:
        "No se puede publicar: varios trabajadores comparten un mismo número de empleado (claves en conflicto al normalizar). Corrija los perfiles o la plantilla (normalización).",
    };
  }

  const parseErrs = imp.parseErrors ?? [];
  if (parseErrs.length > 0) {
    return {
      ok: false as const,
      statusCode: 400,
      message:
        "No se puede publicar: el análisis del Excel registró avisos. Corrija el archivo, el mapeo o la celda de semana y vuelva a importar.",
    };
  }

  let weekStart: Date | null = null;
  if (body.weekStart?.trim()) {
    weekStart = normalizeYmdToIsoWeekMondayUtc(body.weekStart.trim());
    if (!weekStart) {
      return {
        ok: false as const,
        statusCode: 400,
        message:
          "weekStart no válido. Use YYYY-MM-DD (cualquier día de la semana; se guarda el lunes ISO correspondiente) o deje el campo vacío para usar la semana detectada en la hoja.",
      };
    }
  }
  if (!weekStart && imp.weekStartDetected) {
    weekStart = normalizeDateToIsoWeekMondayUtc(
      new Date(imp.weekStartDetected),
    );
  }
  if (!weekStart) {
    return {
      ok: false as const,
      statusCode: 400,
      message:
        "Indique weekStart (YYYY-MM-DD) o configure weekCell en la plantilla para detectar la semana.",
    };
  }

  const rows: IExcelPlanRow[] = imp.previewRows.map((row) => ({
    ...row,
    dayDate: new Date(row.dayDate),
  }));
  remapRowDates(rows, weekStart);

  const weekDoc = await ExcelPlanningWeek.findOneAndUpdate(
    { companyId: r.companyId, weekStart },
    {
      $set: {
        rows,
        sourceStoredFilename: imp.storedFilename,
        sourceFileUrl: imp.fileUrl,
        importId: imp._id,
        templateId: template._id,
        normalizeEmployeeNumber: mapping.normalizeEmployeeNumber,
        publishedBy: req.userId
          ? new mongoose.Types.ObjectId(req.userId as string)
          : undefined,
        publishedAt: new Date(),
      },
    },
    { new: true, upsert: true },
  ).lean();

  imp.status = "published";
  await imp.save();

  return { ok: true as const, data: weekDoc };
}

export async function listWeeksForAdmin(req: Request, limit = 24) {
  const r = requireCompanyForAdmin(req);
  if (!r.ok) return r;
  const docs = await ExcelPlanningWeek.find({ companyId: r.companyId })
    .sort({ weekStart: -1 })
    .limit(limit)
    .select("weekStart publishedAt sourceFileUrl sourceStoredFilename")
    .lean();
  return { ok: true as const, data: docs };
}

export async function getWeekForAdmin(req: Request, weekStartStr: string) {
  const r = requireCompanyForAdmin(req);
  if (!r.ok) return r;
  const weekStart = parseIsoDateUtc(weekStartStr);
  if (!weekStart) {
    return { ok: false as const, statusCode: 400, message: "weekStart inválido." };
  }
  const doc = await ExcelPlanningWeek.findOne({
    companyId: r.companyId,
    weekStart,
  }).lean();
  if (!doc) {
    return { ok: false as const, statusCode: 404, message: "Semana no publicada." };
  }
  return { ok: true as const, data: doc };
}

function currentUtcMonday(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = (day + 6) % 7;
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

export async function getMyPublishedWeek(req: Request, weekStartQuery?: string) {
  const r = requireCompanyForWorker(req);
  if (!r.ok) return r;

  let weekStart: Date | null = null;
  if (weekStartQuery) {
    weekStart = parseIsoDateUtc(weekStartQuery);
  } else {
    weekStart = currentUtcMonday();
  }
  if (!weekStart) {
    return { ok: false as const, statusCode: 400, message: "Semana inválida." };
  }

  const doc = await ExcelPlanningWeek.findOne({
    companyId: r.companyId,
    weekStart,
  }).lean();
  if (!doc) {
    return {
      ok: true as const,
      data: {
        weekStart,
        rows: [] as IExcelPlanRow[],
        published: false,
        sourceFileUrl: undefined as string | undefined,
        cardLayout: pickWorkerCardLayoutFromMapping(undefined),
      },
    };
  }

  const meId = new mongoose.Types.ObjectId(req.userId as string);
  const weekAnchor = new Date(doc.weekStart);

  const companyOid = new mongoose.Types.ObjectId(r.companyId);

  const rowsFiltered = doc.rows.filter(
    (row) =>
      (row.matchedUserId && String(row.matchedUserId) === String(meId)) ||
      (row.matchedPartnerUserId &&
        String(row.matchedPartnerUserId) === String(meId)),
  );

  const normMode: "trim" | "trim_strip_leading_zeros" =
    doc.normalizeEmployeeNumber === "trim_strip_leading_zeros"
      ? "trim_strip_leading_zeros"
      : "trim";

  const needPartnerRematch = rowsFiltered.some(
    (row) =>
      !row.matchedPartnerUserId &&
      Boolean(partnerRawForRematch(row)),
  );

  const byNumberForRematch = needPartnerRematch
    ? (await buildEmployeeMaps(companyOid, {
        normalizeEmployeeNumber: normMode,
      } as ExcelPlanningMapping)).byNumber
    : null;

  const userIds = new Set<string>();
  for (const row of rowsFiltered) {
    if (row.matchedUserId) userIds.add(String(row.matchedUserId));
    if (row.matchedPartnerUserId) userIds.add(String(row.matchedPartnerUserId));
  }
  if (byNumberForRematch) {
    for (const row of rowsFiltered) {
      const p = resolvePartnerUserIdStringForRead(
        row,
        byNumberForRematch,
        normMode,
      );
      if (p) userIds.add(p);
    }
  }

  type UserLabelRole = {
    _id: mongoose.Types.ObjectId;
    name?: string;
    lastName?: string;
    ambulanceRole?: "driver" | "medic" | "both";
  };

  const userDocs =
    userIds.size > 0
      ? await User.find({
          _id: {
            $in: [...userIds].map((id) => new mongoose.Types.ObjectId(id)),
          },
          companyId: companyOid,
          role: "worker",
          isActive: { $ne: false },
        })
          .select("name lastName ambulanceRole")
          .lean<UserLabelRole[]>()
      : [];

  const labelById = new Map<string, string>();
  const roleById = new Map<string, "driver" | "medic" | "both" | undefined>();
  for (const u of userDocs) {
    const ln = (u.lastName ?? "").trim();
    const n = (u.name ?? "").trim();
    const label = ln && n ? `${ln}, ${n}` : ln || n || "—";
    const id = String(u._id);
    labelById.set(id, label);
    roleById.set(id, u.ambulanceRole);
  }

  const rows = rowsFiltered.map((row) => {
    const fixed = fixRowDayDateIfLegacy(row, weekAnchor);
    const primaryId = fixed.matchedUserId
      ? String(fixed.matchedUserId)
      : undefined;
    const partnerIdResolved = byNumberForRematch
      ? resolvePartnerUserIdStringForRead(
          fixed,
          byNumberForRematch,
          normMode,
        )
      : fixed.matchedPartnerUserId
        ? String(fixed.matchedPartnerUserId)
        : undefined;

    const primaryLabel =
      (primaryId ? labelById.get(primaryId) : undefined) ||
      fixed.displayNameFromExcel?.trim() ||
      "";
    const partnerLabel =
      (partnerIdResolved ? labelById.get(partnerIdResolved) : undefined) ||
      fixed.displayPartnerNameFromExcel?.trim() ||
      "";

    let next: Record<string, unknown> = { ...fixed };
    if (primaryLabel) next = { ...next, displayNameFromExcel: primaryLabel };
    if (partnerLabel) next = { ...next, displayPartnerNameFromExcel: partnerLabel };
    if (partnerIdResolved) {
      next.matchedPartnerUserId = new mongoose.Types.ObjectId(
        partnerIdResolved,
      );
    }

    const primaryAmbulanceRole = primaryId
      ? roleById.get(primaryId)
      : undefined;
    const partnerAmbulanceRole = partnerIdResolved
      ? roleById.get(partnerIdResolved)
      : undefined;

    return {
      ...next,
      primaryAmbulanceRole,
      partnerAmbulanceRole,
    } as typeof fixed & {
      primaryAmbulanceRole?: "driver" | "medic" | "both";
      partnerAmbulanceRole?: "driver" | "medic" | "both";
    };
  });

  const templateDoc = await ExcelPlanningTemplate.findOne({
    companyId: r.companyId,
  }).lean();
  const cardLayout = pickWorkerCardLayoutFromMapping(
    templateDoc?.mapping as ExcelPlanningMapping | undefined,
  );

  return {
    ok: true as const,
    data: {
      weekStart: doc.weekStart,
      rows,
      published: true,
      sourceFileUrl: doc.sourceFileUrl,
      cardLayout,
    },
  };
}

function pickWorkerCardLayoutFromMapping(
  mapping: ExcelPlanningMapping | undefined,
): WorkerCardLayout {
  const w = mapping?.workerCardLayout;
  if (!w || typeof w !== "object") {
    return workerCardLayoutSchema.parse({});
  }
  const p = workerCardLayoutSchema.safeParse(w);
  return p.success ? p.data : workerCardLayoutSchema.parse({});
}

export async function discardImportForAdmin(req: Request, importId: string) {
  const r = requireCompanyForAdmin(req);
  if (!r.ok) return r;
  const res = await ExcelPlanningImport.updateOne(
    { _id: importId, companyId: r.companyId, status: "draft" },
    { $set: { status: "discarded" } },
  );
  if (res.matchedCount === 0) {
    return { ok: false as const, statusCode: 404, message: "Borrador no encontrado." };
  }
  return { ok: true as const, data: { discarded: true } };
}
