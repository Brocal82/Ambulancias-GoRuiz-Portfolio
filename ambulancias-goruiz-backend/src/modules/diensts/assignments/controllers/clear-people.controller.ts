import { Request, Response } from "express";
import * as assignmentsService from "../services/assignments.service";
import { DienstAssignmentError } from "../services/assignment-errors";

export const clearPeopleForWeek = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { dienstNumber, weekStartDate } = req.body as {
      dienstNumber?: number;
      weekStartDate?: string;
    };

    if (!dienstNumber || !weekStartDate) {
      res
        .status(400)
        .json({ message: "Faltan parámetros: dienstNumber, weekStartDate" });
      return;
    }

    const start = new Date(weekStartDate);
    if (isNaN(start.getTime())) {
      res.status(400).json({ message: "weekStartDate inválida" });
      return;
    }

    const result = await assignmentsService.clearPeopleForWeek(
      { dienstNumber, weekStartDate },
      req.companyId ?? undefined,
    );

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof DienstAssignmentError) {
      const body: Record<string, unknown> = {
        code: error.code,
        message: error.message,
      };
      if (error.details !== undefined) body.details = error.details;
      res.status(error.statusCode).json(body);
      return;
    }
    console.error("❌ Error en clearPeopleForWeek:", error);
    res
      .status(500)
      .json({ message: "Error al limpiar asignaciones de la semana" });
  }
};
