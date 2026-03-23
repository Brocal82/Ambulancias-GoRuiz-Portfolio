import { Request, Response } from "express";
import mongoose from "mongoose";
import * as assignmentsService from "../services/assignments.service";
import { DienstAssignmentError } from "../services/assignment-errors";
import { requireCompanyForAdmin } from "../../../../utils/requireCompany";

export const assignUserToWeek = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const { dienstNumber, weekStartDate, userId, role } = req.body as {
      dienstNumber?: number;
      weekStartDate?: string;
      userId?: string;
      role?: "driver" | "medic";
    };

    if (!dienstNumber || !weekStartDate || !userId || !role) {
      res
        .status(400)
        .json({
          message:
            "Faltan parámetros: dienstNumber, weekStartDate, userId, role",
        });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ message: "userId inválido" });
      return;
    }

    if (role !== "driver" && role !== "medic") {
      res
        .status(400)
        .json({ message: 'Rol inválido. Debe ser "driver" o "medic"' });
      return;
    }

    const start = new Date(weekStartDate);
    if (isNaN(start.getTime())) {
      res.status(400).json({ message: "weekStartDate inválida" });
      return;
    }

    const result = await assignmentsService.assignUserToWeek(
      {
        dienstNumber,
        weekStartDate,
        userId,
        role,
      },
      companyResult.companyId,
    );

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof DienstAssignmentError) {
      const body: Record<string, unknown> = {
        code: error.code,
        message: error.message,
      };
      if (error.details) body.details = error.details;
      res.status(error.statusCode).json(body);
      return;
    }
    console.error("❌ Error en assignUserToWeek:", error);
    res
      .status(500)
      .json({ message: "Error al asignar el usuario a la semana" });
  }
};
