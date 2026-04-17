import type { Request } from "express";

export type RequireCompanyResult =
  | { ok: true; companyId: string }
  | { ok: false; statusCode: 403; message: string };

/**
 * Exige que el admin tenga companyId. Usar en operaciones multiempresa.
 * Devuelve 403 si admin no tiene companyId.
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
 * Exige que el worker tenga companyId. Usar en operaciones multiempresa del lado worker.
 */
export function requireCompanyForWorker(req: Request): RequireCompanyResult {
  if (req.userRole !== "worker") {
    return {
      ok: false,
      statusCode: 403,
      message: "Operación requiere rol trabajador con empresa asignada",
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

function hasCompanyId(value: unknown): boolean {
  if (value == null) return false;
  const s = String(value).trim();
  return s !== "";
}

/**
 * Comprueba si un usuario pertenece a la misma empresa que el admin.
 * Requiere companyId en ambos lados.
 */
export function isSameCompany(
  targetUserCompanyId: unknown,
  adminCompanyId: string | null | undefined,
): boolean {
  if (!hasCompanyId(adminCompanyId) || !hasCompanyId(targetUserCompanyId)) {
    return false;
  }
  return String(targetUserCompanyId) === String(adminCompanyId);
}

/**
 * Comprueba si un dienst pertenece a la empresa indicada.
 * Requiere companyId en ambos lados.
 */
export function isDienstFromCompany(
  dienstCompanyId: unknown,
  companyId: string | null | undefined,
): boolean {
  if (!hasCompanyId(companyId) || !hasCompanyId(dienstCompanyId)) {
    return false;
  }
  return String(dienstCompanyId) === String(companyId);
}

/**
 * Comprueba si un recurso (ambulance, hospital, etc.) pertenece a la empresa indicada.
 */
export function isResourceFromCompany(
  resourceCompanyId: unknown,
  companyId: string | null | undefined,
): boolean {
  return isDienstFromCompany(resourceCompanyId, companyId);
}

/**
 * Comprueba si dos entidades pertenecen a la misma empresa.
 * Requiere companyId en ambos lados.
 */
export function entitiesBelongToSameCompany(
  entityACo: unknown,
  entityBCo: unknown,
): boolean {
  if (!hasCompanyId(entityACo) || !hasCompanyId(entityBCo)) {
    return false;
  }
  return String(entityACo) === String(entityBCo);
}

/** Error para validaciones cross-company (status 403) */
export class CompanyValidationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 403,
  ) {
    super(message);
    this.name = "CompanyValidationError";
  }
}
