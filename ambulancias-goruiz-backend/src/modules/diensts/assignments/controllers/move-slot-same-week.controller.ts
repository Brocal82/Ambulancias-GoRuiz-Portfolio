import { RequestHandler } from "express";
import * as assignmentsService from "../services/assignments.service";
import { DienstAssignmentError } from "../services/assignment-errors";
import { requireCompanyForAdmin } from "../../../../utils/requireCompany";

export const moveSlotSameWeek: RequestHandler = async (req, res) => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }

    await assignmentsService.moveSlotSameWeek(req.body, companyResult.companyId);
    res.status(200).json({ ok: true });
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
    console.error("moveSlotSameWeek:", error);
    res.status(500).json({ message: "Error al mover la asignación" });
  }
};
