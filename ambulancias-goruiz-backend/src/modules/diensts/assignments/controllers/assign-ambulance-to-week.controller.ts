import { Request, Response } from "express";
import * as assignmentsService from "../services/assignments.service";
import { DienstAssignmentError } from "../services/assignment-errors";
import { requireCompanyForAdmin } from "../../../../utils/requireCompany";
import type { z } from "zod";
import type { assignAmbulanceToWeekSchema } from "../../schemas/shared.schema";

type AssignAmbulanceBody = z.infer<typeof assignAmbulanceToWeekSchema>;

export const assignAmbulanceToWeek = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }

    const { dienstNumber, weekStartDate, ambulanceId } =
      req.body as AssignAmbulanceBody;

    const result = await assignmentsService.assignAmbulanceToWeek(
      { dienstNumber, weekStartDate, ambulanceId },
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
    console.error("❌ Error en assignAmbulanceToWeek:", error);
    res.status(500).json({ message: "Error al asignar la ambulancia a la semana" });
  }
};
