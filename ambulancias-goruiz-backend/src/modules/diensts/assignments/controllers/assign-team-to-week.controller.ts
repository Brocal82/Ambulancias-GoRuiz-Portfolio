import { Request, Response } from "express";
import mongoose from "mongoose";
import * as assignmentsService from "../services/assignments.service";
import { DienstAssignmentError } from "../services/assignment-errors";
import { requireCompanyForAdmin } from "../../../../utils/requireCompany";
import type { z } from "zod";
import type { assignTeamToWeekSchema } from "../../schemas/shared.schema";

type AssignTeamBody = z.infer<typeof assignTeamToWeekSchema>;

export const assignTeamToWeek = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const { dienstNumber, weekStartDate, teamId, resolvedRoles } =
      req.body as AssignTeamBody;

    const result = await assignmentsService.assignTeamToWeek(
      {
        dienstNumber,
        weekStartDate,
        teamId,
        resolvedRoles,
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
    console.error("❌ Error en assignTeamToWeek:", error);
    res.status(500).json({ message: "Error al asignar el Team a la semana" });
  }
};
