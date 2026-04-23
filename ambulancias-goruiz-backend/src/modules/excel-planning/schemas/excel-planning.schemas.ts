import { z } from "zod";

export const cellLineRoleSchema = z.enum([
  "time",
  "vehicle",
  "employeeNumber",
  "name",
  "partnerName",
  /** Tras los nombres: nº del compañero (opcional); si va antes de name, celdas de 5 líneas fallan. */
  "partnerEmployeeNumber",
  "ignore",
]);

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
  /** Orden de líneas dentro de cada celda multilínea. */
  cellLineOrder: z.array(cellLineRoleSchema).min(1),
  nameMatching: z
    .enum(["employee_number_only", "employee_number_then_name"])
    .default("employee_number_only"),
  /** Por defecto quitar ceros a la izquierda para alinear perfil "0001" con Excel "1". */
  normalizeEmployeeNumber: z
    .enum(["trim", "trim_strip_leading_zeros"])
    .default("trim_strip_leading_zeros"),
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
