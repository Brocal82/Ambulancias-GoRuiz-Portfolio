import mongoose from "mongoose";
import Company from "../../companies/models/company.model";

export type PraemienModeEffectiveFrom = { year: number; month: number };

export type ManualPraemienDailyApiGate =
  | {
      allowed: true;
      companyObjectId: mongoose.Types.ObjectId;
      effectiveFrom: PraemienModeEffectiveFrom;
      workdayEnabled: boolean;
    }
  | { allowed: false; statusCode: number; message: string };

/**
 * Manual daily-entry APIs are allowed only when the company is in effective
 * manual mode: stored mode is `manual`, effective-from is set, and today is
 * on or after the first day of that month (same rule as Phase 3 product spec).
 */
export async function assertManualPraemienDailyApisAllowed(
  companyIdStr: string | undefined,
): Promise<ManualPraemienDailyApiGate> {
  if (!companyIdStr || !mongoose.Types.ObjectId.isValid(companyIdStr)) {
    return {
      allowed: false,
      statusCode: 403,
      message: "No tienes empresa asignada.",
    };
  }

  const company = await Company.findById(companyIdStr)
    .select("praemienMode praemienModeEffectiveFrom enabledModules")
    .lean();

  if (!company) {
    return {
      allowed: false,
      statusCode: 403,
      message: "Empresa no encontrada.",
    };
  }

  const mode = company.praemienMode ?? "automatic";
  if (mode !== "manual") {
    return {
      allowed: false,
      statusCode: 403,
      message:
        "Las entradas diarias manuales de Prämien no están disponibles en modo automático.",
    };
  }

  const from = company.praemienModeEffectiveFrom;
  if (
    !from ||
    typeof from.year !== "number" ||
    typeof from.month !== "number" ||
    from.month < 1 ||
    from.month > 12
  ) {
    return {
      allowed: false,
      statusCode: 403,
      message:
        "El modo manual de Prämien no tiene fecha de entrada en vigor configurada.",
    };
  }

  const effectiveStart = new Date(from.year, from.month - 1, 1);
  effectiveStart.setHours(0, 0, 0, 0);
  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  if (todayStart < effectiveStart) {
    return {
      allowed: false,
      statusCode: 403,
      message: "El modo manual de Prämien aún no está vigente para esta empresa.",
    };
  }

  return {
    allowed: true,
    companyObjectId: new mongoose.Types.ObjectId(companyIdStr),
    effectiveFrom: { year: from.year, month: from.month },
    workdayEnabled: Array.isArray(company.enabledModules)
      ? company.enabledModules.includes("workday")
      : false,
  };
}

/** Parse YYYY-MM-DD as local calendar date (midnight). */
export function parseCalendarDateLocal(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return dt;
}

export function assertDateAllowedForManualEntry(
  dateStr: string,
  effectiveFrom: PraemienModeEffectiveFrom,
  now: Date = new Date(),
): { ok: true; day: Date } | { ok: false; message: string } {
  const day = parseCalendarDateLocal(dateStr);
  if (!day) {
    return { ok: false, message: "Fecha inválida (use YYYY-MM-DD)." };
  }

  const effectiveStart = new Date(effectiveFrom.year, effectiveFrom.month - 1, 1);
  effectiveStart.setHours(0, 0, 0, 0);

  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  if (day < effectiveStart) {
    return {
      ok: false,
      message: "No se pueden registrar valores antes del inicio del modo manual.",
    };
  }
  if (day > todayStart) {
    return { ok: false, message: "No se pueden registrar fechas futuras." };
  }

  return { ok: true, day };
}
