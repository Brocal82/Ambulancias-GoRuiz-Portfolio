import type { Request } from "express";
import mongoose from "mongoose";

export type ResolveAccessibleUserIdResult =
  | { ok: true; userId: string }
  | { ok: false; statusCode: 400 | 401; message: string };

/**
 * Resuelve el userId accesible según rol y contexto.
 * - Admin: puede usar paramUserId si existe (validado como ObjectId); si no, usa req.userId.
 * - Worker: ignora paramUserId, usa siempre req.userId.
 * Devuelve resultado tipado explícito para evitar ambigüedad en controllers.
 */
export function resolveAccessibleUserId(
  req: Request,
  paramUserId: string | undefined,
): ResolveAccessibleUserIdResult {
  const isAdmin = req.userRole === "admin";
  const authUserId = req.userId ?? undefined;

  if (isAdmin && paramUserId) {
    if (!mongoose.Types.ObjectId.isValid(paramUserId)) {
      return { ok: false, statusCode: 400, message: "userId inválido" };
    }
    return { ok: true, userId: paramUserId };
  }

  if (!authUserId) {
    return { ok: false, statusCode: 401, message: "No autorizado" };
  }
  return { ok: true, userId: authUserId };
}
