import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../../users/models/user.model";
import {
  isSameCompany,
  requireCompanyForAdmin,
} from "../../../utils/requireCompany";
import { getMonthlyHistoryForUser } from "../services/get-monthly-history.service";
import { getMonthlySummaryForUser } from "../services/get-monthly-summary.service";

type ResolvePraemienResult =
  | string
  | null
  | { statusCode: number; message: string };

/**
 * Resuelve el userId autorizado para consultar praemien.
 * - Admin con ?userId=: solo si el objetivo pertenece a la misma empresa (JWT) que el admin.
 * - Admin sin query: sus propios datos (req.userId).
 * - Worker / superadmin: solo req.userId; query userId se ignora (igual que antes).
 */
async function resolvePraemienUserId(req: Request): Promise<ResolvePraemienResult> {
  const isAdmin = req.userRole === "admin";
  const requestedUserId = req.query.userId as string | undefined;

  if (isAdmin && requestedUserId) {
    if (!mongoose.Types.ObjectId.isValid(requestedUserId)) {
      return { statusCode: 400, message: "userId inválido" };
    }
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      return {
        statusCode: companyResult.statusCode,
        message: companyResult.message,
      };
    }
    const targetUser = await User.findById(requestedUserId)
      .select("companyId")
      .lean();
    if (!targetUser) {
      return { statusCode: 404, message: "Usuario no encontrado" };
    }
    const userCo = (targetUser as { companyId?: unknown }).companyId;
    if (!isSameCompany(userCo, companyResult.companyId)) {
      return {
        statusCode: 403,
        message: "No tienes permiso para ver los datos de este usuario",
      };
    }
    return requestedUserId;
  }

  return req.userId ?? null;
}

function isErrorResult(
  r: ResolvePraemienResult,
): r is { statusCode: number; message: string } {
  return typeof r === "object" && r !== null && "statusCode" in r;
}

export const getMonthlyPraemienSummary = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const result = await resolvePraemienUserId(req);
    if (isErrorResult(result)) {
      res.status(result.statusCode).json({ message: result.message });
      return;
    }
    if (!result) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const summary = await getMonthlySummaryForUser(result);
    res.status(200).json(summary);
  } catch (error) {
    console.error("Error en getMonthlyPraemienSummary:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const getPraemienMonthlyHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const result = await resolvePraemienUserId(req);
    if (isErrorResult(result)) {
      res.status(result.statusCode).json({ message: result.message });
      return;
    }
    if (!result) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const history = await getMonthlyHistoryForUser(result);
    res.status(200).json(history);
  } catch (error) {
    console.error("Error en getPraemienMonthlyHistory:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
