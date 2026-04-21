import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../../users/models/user.model";
import {
  isSameCompany,
  requireCompanyForAdmin,
} from "../../../utils/requireCompany";
import {
  adminApproveManualDailyEntry,
  adminCorrectApproveManualDailyEntry,
  adminListManualDailyEntriesForMonth,
  adminRejectManualDailyEntry,
  adminReopenManualDailyEntry,
} from "../services/praemien-manual-daily-admin.service";

async function assertAdminSameCompanyAsTarget(
  req: Request,
  targetUserId: string | undefined,
): Promise<
  | { ok: true; companyId: string; targetUserId: string }
  | { ok: false; statusCode: number; message: string }
> {
  const cr = requireCompanyForAdmin(req);
  if (!cr.ok) {
    return { ok: false, statusCode: cr.statusCode, message: cr.message };
  }

  if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
    return { ok: false, statusCode: 400, message: "userId inválido o ausente." };
  }

  const targetUser = await User.findById(targetUserId).select("companyId").lean();
  if (!targetUser) {
    return { ok: false, statusCode: 404, message: "Usuario no encontrado." };
  }

  const userCo = (targetUser as { companyId?: unknown }).companyId;
  if (!isSameCompany(userCo, cr.companyId)) {
    return {
      ok: false,
      statusCode: 403,
      message: "No tienes permiso para gestionar a este usuario.",
    };
  }

  return { ok: true, companyId: cr.companyId, targetUserId };
}

export const adminGetManualDailyMonth = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const gate = await assertAdminSameCompanyAsTarget(
      req,
      req.query.userId as string | undefined,
    );
    if (!gate.ok) {
      res.status(gate.statusCode).json({ message: gate.message });
      return;
    }

    const year = Number(req.query.year);
    const month = Number(req.query.month);

    const result = await adminListManualDailyEntriesForMonth({
      companyIdStr: gate.companyId,
      targetUserId: gate.targetUserId,
      year,
      month,
    });

    if (!result.ok) {
      res.status(result.statusCode).json({ message: result.message });
      return;
    }

    res.status(200).json(result.entries);
  } catch (error) {
    console.error("Error en adminGetManualDailyMonth:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const adminPostManualDailyApprove = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const gate = await assertAdminSameCompanyAsTarget(req, req.body?.userId);
    if (!gate.ok) {
      res.status(gate.statusCode).json({ message: gate.message });
      return;
    }

    const result = await adminApproveManualDailyEntry({
      companyIdStr: gate.companyId,
      targetUserId: gate.targetUserId,
      date: req.body?.date,
      adminUserId: userId,
      adminFinalValue: req.body?.adminFinalValue,
    });

    if (!result.ok) {
      res.status(result.statusCode).json({ message: result.message });
      return;
    }

    res.status(200).json(result.entry);
  } catch (error) {
    console.error("Error en adminPostManualDailyApprove:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const adminPostManualDailyReject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const gate = await assertAdminSameCompanyAsTarget(req, req.body?.userId);
    if (!gate.ok) {
      res.status(gate.statusCode).json({ message: gate.message });
      return;
    }

    const result = await adminRejectManualDailyEntry({
      companyIdStr: gate.companyId,
      targetUserId: gate.targetUserId,
      date: req.body?.date,
      adminUserId: userId,
      reason: req.body?.reason,
    });

    if (!result.ok) {
      res.status(result.statusCode).json({ message: result.message });
      return;
    }

    res.status(200).json(result.entry);
  } catch (error) {
    console.error("Error en adminPostManualDailyReject:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const adminPostManualDailyCorrectApprove = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const gate = await assertAdminSameCompanyAsTarget(req, req.body?.userId);
    if (!gate.ok) {
      res.status(gate.statusCode).json({ message: gate.message });
      return;
    }

    const result = await adminCorrectApproveManualDailyEntry({
      companyIdStr: gate.companyId,
      targetUserId: gate.targetUserId,
      date: req.body?.date,
      adminUserId: userId,
      adminFinalValue: req.body?.adminFinalValue,
    });

    if (!result.ok) {
      res.status(result.statusCode).json({ message: result.message });
      return;
    }

    res.status(200).json(result.entry);
  } catch (error) {
    console.error("Error en adminPostManualDailyCorrectApprove:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const adminPostManualDailyReopen = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const gate = await assertAdminSameCompanyAsTarget(req, req.body?.userId);
    if (!gate.ok) {
      res.status(gate.statusCode).json({ message: gate.message });
      return;
    }

    const result = await adminReopenManualDailyEntry({
      companyIdStr: gate.companyId,
      targetUserId: gate.targetUserId,
      date: req.body?.date,
      adminUserId: userId,
      note: req.body?.note,
    });

    if (!result.ok) {
      res.status(result.statusCode).json({ message: result.message });
      return;
    }

    res.status(200).json(result.entry);
  } catch (error) {
    console.error("Error en adminPostManualDailyReopen:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
