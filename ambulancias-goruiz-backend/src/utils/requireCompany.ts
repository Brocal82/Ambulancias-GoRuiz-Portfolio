import type { Request } from "express";

export type RequireCompanyResult =
  | { ok: true; companyId: string }
  | { ok: false; statusCode: 403; message: string };

/**
 * Exige que el admin tenga companyId. Usar en operaciones multiempresa.
 * Devuelve 403 si admin no tiene companyId (legacy admin).
 */
export function requireCompanyForAdmin(req: Request): RequireCompanyResult {
  if (req.userRole !== "admin") {
    return {
      ok: false,
      statusCode: 403,
      message: "Operación requiere rol admin con empresa asignada",
    };
  }
  const companyId = req.companyId;
  if (!companyId || typeof companyId !== "string") {
    return {
      ok: false,
      statusCode: 403,
      message: "No tienes permiso. Se requiere pertenecer a una empresa.",
    };
  }
  return { ok: true, companyId };
}

/**
 * Comprueba si un usuario pertenece a la misma empresa que el admin.
 * targetUser debe tener companyId que coincida con companyId.
 * Ambos null/undefined = mismo "legacy" (true).
 */
export function isSameCompany(
  targetUserCompanyId: unknown,
  adminCompanyId: string | null | undefined,
): boolean {
  if (!adminCompanyId) return !targetUserCompanyId;
  if (!targetUserCompanyId) return false;
  return String(targetUserCompanyId) === String(adminCompanyId);
}

/**
 * Comprueba si un dienst pertenece a la empresa indicada.
 * Para legacy: dienst sin companyId solo coincide si companyId es null/undefined.
 */
export function isDienstFromCompany(
  dienstCompanyId: unknown,
  companyId: string | null | undefined,
): boolean {
  if (!companyId) return !dienstCompanyId;
  if (!dienstCompanyId) return false;
  return String(dienstCompanyId) === String(companyId);
}

/**
 * Comprueba si un recurso (ambulance, hospital, etc.) pertenece a la empresa indicada.
 * Para legacy: recurso sin companyId solo coincide si companyId es null/undefined.
 */
export function isResourceFromCompany(
  resourceCompanyId: unknown,
  companyId: string | null | undefined,
): boolean {
  return isDienstFromCompany(resourceCompanyId, companyId);
}
