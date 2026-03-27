import { Request, Response } from "express";
import { RequestHandler } from "express";
import mongoose from "mongoose";
import { ZodError, z } from "zod";
import { resolveAccessibleUserId } from "../../../../utils/resolveAccessibleUserId";
import { requireCompanyForAdmin, isDienstFromCompany, isSameCompany } from "../../../../utils/requireCompany";
import User from "../../../users/models/user.model";
import { dienstQuerySchema } from "../../schemas/dienstQuerySchema";
import * as calendarService from "../services/calendar.service";

const idSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, {
  message: "ID no válido",
});

export const getAllDiensts: RequestHandler = async (req, res) => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const diensts = await calendarService.getAllDiensts(companyResult.companyId);
    res.status(200).json(diensts);
  } catch (error) {
    console.error("Error al obtener los Diensts:", error);
    res.status(500).json({ message: "Error al obtener los Diensts" });
  }
};

export const getDienstById = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);
    const dienst = await calendarService.getDienstById(parsedId);
    if (!dienst) {
      res.status(404).json({ message: "Dienst no encontrado" });
      return;
    }

    const isAdmin = req.userRole === "admin";
    const isParticipant = (dienst.assignments as any[]).some(
      (a) =>
        String(a.driver?._id ?? a.driver) === req.userId ||
        String(a.medic?._id ?? a.medic) === req.userId,
    );

    if (isAdmin) {
      if (!isDienstFromCompany((dienst as any).companyId, req.companyId ?? null)) {
        res.status(403).json({ message: "No tienes permiso para ver este Dienst" });
        return;
      }
    } else {
      if (!isParticipant) {
        res.status(403).json({ message: "No autorizado" });
        return;
      }
      const userCompanyId = req.companyId ?? null;
      if (!isDienstFromCompany((dienst as any).companyId, userCompanyId)) {
        res.status(403).json({ message: "No tienes permiso para ver este Dienst" });
        return;
      }
    }

    res.status(200).json(dienst);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: "ID inválido", errors: error.errors });
    } else {
      res.status(500).json({ message: "Error al obtener el Dienst", error });
    }
  }
};

export const searchDienst = async (req: Request, res: Response) => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const parsedQuery = dienstQuerySchema.parse(req.query);
    const dienste = await calendarService.searchDienst(
      parsedQuery,
      companyResult.companyId,
    );
    res.status(200).json(dienste);
  } catch (error) {
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({ message: "Parámetros inválidos", errors: error.errors });
      return;
    }
    res.status(500).json({ message: "Error al buscar Diensts", error });
    return;
  }
};

export const getDienstsByUser = async (req: Request, res: Response) => {
  const result = resolveAccessibleUserId(req, req.params.userId);

  if (!result.ok) {
    res.status(result.statusCode).json({ message: result.message });
    return;
  }

  let userCompanyId: string | null = req.companyId ?? null;
  if (req.userRole === "admin" && req.params.userId && req.params.userId !== req.userId) {
    const targetUser = await User.findById(result.userId).select("companyId").lean();
    if (!targetUser || !isSameCompany(targetUser.companyId, req.companyId ?? null)) {
      res.status(403).json({ message: "No tienes permiso para ver Diensts de este usuario" });
      return;
    }
    userCompanyId = targetUser.companyId ? String(targetUser.companyId) : null;
  }

  const rawCompanyId = userCompanyId != null ? String(userCompanyId).trim() : "";
  if (!rawCompanyId || !mongoose.Types.ObjectId.isValid(rawCompanyId)) {
    res.status(403).json({
      message: "No tienes permiso. Se requiere un contexto de empresa válido.",
    });
    return;
  }

  try {
    const diensts = await calendarService.getDienstsByUser(result.userId, rawCompanyId);
    res.status(200).json(diensts);
  } catch (error) {
    console.error("Error fetching diensts:", error);
    res.status(500).json({ message: "Error fetching diensts", error });
  }
};
