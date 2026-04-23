import { z } from "zod";

/**
 * Claves permitidas: campos de ExcelPlanRow o "app_dayDate" (fecha de la celda)
 * o "driver" / "medic" (líneas resueltas con roles de ambulancia).
 */
export const workerCardFieldKeySchema = z.enum([
  "app_dayDate",
  "timeText",
  "vehicleCode",
  "dienstNumber",
  "rowLabel",
  "employeeNumber",
  "partnerEmployeeNumber",
  "displayNameFromExcel",
  "displayPartnerNameFromExcel",
  "rawCellText",
  "driver",
  "medic",
]);

export const workerCardLayoutSchema = z.object({
  dayDateField: workerCardFieldKeySchema.default("app_dayDate"),
  timeField: workerCardFieldKeySchema.default("timeText"),
  vehicleField: workerCardFieldKeySchema.default("vehicleCode"),
  driverField: workerCardFieldKeySchema.default("driver"),
  medicField: workerCardFieldKeySchema.default("medic"),
});

export type WorkerCardLayout = z.infer<typeof workerCardLayoutSchema>;
export type WorkerCardFieldKey = z.infer<typeof workerCardFieldKeySchema>;

/**
 * Nombres que cada empresa asigna a cada parte de la tarjeta (p. ej. "KFZ" / "autoid" frente
 * a "vehicleCode") solo a efectos de documentación en admin; el motor sigue usando workerCardLayout.
 */
export const workerCardLineNameHintsSchema = z.object({
  dayDateField: z.string().max(200).optional(),
  timeField: z.string().max(200).optional(),
  vehicleField: z.string().max(200).optional(),
  driverField: z.string().max(200).optional(),
  medicField: z.string().max(200).optional(),
});
export type WorkerCardLineNameHints = z.infer<typeof workerCardLineNameHintsSchema>;

/** Valores lógicos que el motor entiende al leer/escribir cada línea de la celda. */
export const CANONICAL_CELL_LINE_ROLES = [
  "time",
  "vehicle",
  "employeeNumber",
  "name",
  "partnerName",
  /** Tras los nombres: nº del compañero (opcional); si va antes de name, celdas de 5 líneas fallan. */
  "partnerEmployeeNumber",
  "ignore",
] as const;
export type CellLineRole = (typeof CANONICAL_CELL_LINE_ROLES)[number];

/**
 * La geometría del Excel es fija: cada posición = un rol. Cada empresa puede
 * nombrar ese rol en el JSON como prefiere; aquí se resuelve a un rol canónico.
 * No confundir con el *contenido* de la celda: eso no se interpreta por nombre.
 */
const CELL_LINE_ALIAS_TO_CANONICAL: Readonly<Record<string, CellLineRole>> =
  (() => {
    const o: Record<string, CellLineRole> = {};
    for (const c of CANONICAL_CELL_LINE_ROLES) {
      o[c] = c;
      o[c.toLowerCase()] = c;
    }
    const pairs: [string, CellLineRole][] = [
      // vehicle
      ["autoid", "vehicle"],
      ["autoId", "vehicle"],
      ["auto_id", "vehicle"],
      ["kfz", "vehicle"],
      ["wagen", "vehicle"],
      ["fahrzeug", "vehicle"],
      ["fzg", "vehicle"],
      // time
      ["dienstzeit", "time"],
      ["zeit", "time"],
      ["uhr", "time"],
      ["hora", "time"],
      ["rango", "time"],
      // employee
      ["empleado", "employeeNumber"],
      // name
      ["nombre", "name"],
      ["personal", "name"],
      ["mitarbeiter", "name"],
      // partner
      ["compañero", "partnerName"],
      ["companero", "partnerName"],
      // partner nº
      ["partnerem", "partnerEmployeeNumber"],
      ["partner_emp", "partnerEmployeeNumber"],
      ["socio", "partnerEmployeeNumber"],
      // ignore
      ["omitir", "ignore"],
    ];
    for (const [a, c] of pairs) {
      o[a] = c;
      o[a.toLowerCase()] = c;
    }
    return o;
  })();

export function resolveCellLineRoleToCanonical(raw: string): CellLineRole | null {
  const t = raw.trim();
  if (!t) return null;
  return CELL_LINE_ALIAS_TO_CANONICAL[t] ?? CELL_LINE_ALIAS_TO_CANONICAL[t.toLowerCase()] ?? null;
}

/**
 * Cada string debe ser canónico o un alias; el guardado en BD puede quedar
 * con el nombre que eligió la empresa; el parseo usa el rol canónico.
 */
export const cellLineOrderFieldSchema = z
  .array(z.string().min(1, "Cada rol de línea debe ser un texto no vacío."))
  .min(1, "Se requiere al menos un rol de línea (orden de líneas en la celda).")
  .superRefine((arr, ctx) => {
    for (let i = 0; i < arr.length; i++) {
      if (resolveCellLineRoleToCanonical(arr[i]) == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i],
          message: `Rol de línea desconocido: «${arr[i]}». Use p. ej. time, vehicle, employeeNumber o un alias (p. ej. autoid).`,
        });
      }
    }
  });

export const excelPlanningMappingSchema = z.object({
  sheetIndex: z.number().int().min(0).default(0),
  /** Celda donde leer texto de semana (fecha, KW 12/2026, etc.). Opcional si siempre se envía weekStart al publicar. */
  weekCell: z
    .object({
      row: z.number().int().min(0),
      col: z.number().int().min(0),
    })
    .optional(),
  /** Si true y weekCell está definida, el parse exige poder resolver la semana desde la hoja. */
  requireWeekFromSheet: z.boolean().default(false),
  /** Primera fila de datos (0-based). */
  dataStartRow: z.number().int().min(0),
  /** Última fila inclusive (0-based); si omitido, se avanza hasta fila vacía en dienstNumber. */
  dataEndRow: z.number().int().min(0).optional(),
  /** Columna del número de Dienst / fila de parrilla (0-based). */
  dienstNumberColumn: z.number().int().min(0),
  /** Columna opcional con etiqueta de fila (p. ej. “Dienstzeit Wagen”). */
  rowLabelColumn: z.number().int().min(0).optional(),
  /** Siete columnas: lunes … domingo (0-based). */
  dayColumns: z
    .tuple([
      z.number().int().min(0),
      z.number().int().min(0),
      z.number().int().min(0),
      z.number().int().min(0),
      z.number().int().min(0),
      z.number().int().min(0),
      z.number().int().min(0),
    ]),
  lineDelimiter: z.string().default("\n"),
  /** Orden de líneas dentro de cada celda multilínea (nombres canónicos o alias por empresa, ver resolveCellLineRoleToCanonical). */
  cellLineOrder: cellLineOrderFieldSchema,
  nameMatching: z
    .enum(["employee_number_only", "employee_number_then_name"])
    .default("employee_number_only"),
  /** Por defecto quitar ceros a la izquierda para alinear perfil "0001" con Excel "1". */
  normalizeEmployeeNumber: z
    .enum(["trim", "trim_strip_leading_zeros"])
    .default("trim_strip_leading_zeros"),
  /** Qué campo de fila lógica va a cada línea de la tarjeta del trabajador (vista /worker/excel-planning). */
  workerCardLayout: workerCardLayoutSchema.optional(),
  /**
   * Por empresa: cómo llaman a cada “parte” de la ficha (Excel / argot interno), informativo en admin.
   * Las claves se alinean con workerCardLayout.
   */
  workerCardLineNameHints: workerCardLineNameHintsSchema.optional(),
});

export const putExcelPlanningTemplateSchema = z.object({
  name: z.string().max(200).optional(),
  mapping: excelPlanningMappingSchema,
});

export const publishExcelImportSchema = z.object({
  /** Lunes de la semana (YYYY-MM-DD). Si falta, se usa la detectada en el import. */
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/** Filas lógicas → mismas celdas que produce el import (inverso del parseo). */
export const excelExportRowSchema = z
  .object({
    dayIndex: z.number().int().min(0).max(6).optional(),
    dayDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    dienstNumber: z.string().min(1),
    rowLabel: z.string().optional(),
    timeText: z.string().optional(),
    vehicleCode: z.string().optional(),
    employeeNumber: z.string().optional(),
    partnerEmployeeNumber: z.string().optional(),
    displayNameFromExcel: z.string().optional(),
    displayPartnerNameFromExcel: z.string().optional(),
  })
  .superRefine((row, ctx) => {
    if (row.dayIndex === undefined && row.dayDate === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dayIndex"],
        message: "Indique dayIndex (0–6) o dayDate (YYYY-MM-DD).",
      });
    }
  });

export const postExcelExportSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rows: z.array(excelExportRowSchema).min(1),
});

export type ExcelPlanningMapping = z.infer<typeof excelPlanningMappingSchema>;
export type PutExcelPlanningTemplateBody = z.infer<
  typeof putExcelPlanningTemplateSchema
>;
export type PublishExcelImportBody = z.infer<typeof publishExcelImportSchema>;
export type PostExcelExportBody = z.infer<typeof postExcelExportSchema>;
export type ExcelExportRow = z.infer<typeof excelExportRowSchema>;
