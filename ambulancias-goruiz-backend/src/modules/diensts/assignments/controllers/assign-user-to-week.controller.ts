import { Request, Response } from "express";
import * as assignmentsService from "../services/assignments.service";
import { DienstAssignmentError } from "../services/assignment-errors";
import { requireCompanyForAdmin } from "../../../../utils/requireCompany";
import type { z } from "zod";
import type { assignUserToWeekSchema } from "../../schemas/shared.schema";

type AssignUserBody = z.infer<typeof assignUserToWeekSchema>;

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
    const { dienstNumber, weekStartDate, userId, role } =
      req.body as AssignUserBody;

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
