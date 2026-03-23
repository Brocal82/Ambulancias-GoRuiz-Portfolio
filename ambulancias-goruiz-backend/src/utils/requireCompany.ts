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
 */
export function isSameCompany(
  targetUserCompanyId: unknown,
  adminCompanyId: string,
): boolean {
  if (!targetUserCompanyId) return false;
  return String(targetUserCompanyId) === String(adminCompanyId);
}
