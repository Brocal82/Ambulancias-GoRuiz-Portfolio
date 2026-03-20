import type { z } from "zod";
import type { dienstQuerySchema } from "../schemas/dienstQuerySchema";

export type DienstQueryParams = z.infer<typeof dienstQuerySchema>;

/**
 * Construye el objeto de query para Dienst.find() a partir de los parámetros
 * parseados por dienstQuerySchema.
 * Función pura, sin side effects.
 */
export function buildDienstSearchQuery(
  parsed: DienstQueryParams,
): Record<string, unknown> {
  const query: Record<string, unknown> = {};

  if (parsed.dienstNumber) {
    const num = parseInt(parsed.dienstNumber, 10);
    if (!isNaN(num)) query.dienstNumber = num;
  }

  if (parsed.weekStartDate) {
    query.weekStartDate = parsed.weekStartDate;
  }

  if (parsed.date) {
    query["assignments.date"] = parsed.date;
  }

  if (parsed.driver) {
    query["assignments.driver"] = parsed.driver;
  }

  if (parsed.medic) {
    query["assignments.medic"] = parsed.medic;
  }

  return query;
}
