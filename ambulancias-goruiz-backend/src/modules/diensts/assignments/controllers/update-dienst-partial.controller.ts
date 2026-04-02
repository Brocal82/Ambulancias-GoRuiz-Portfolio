import { RequestHandler } from "express";
import * as assignmentsService from "../services/assignments.service";
import { DienstAssignmentError } from "../services/assignment-errors";
import { requireCompanyForAdmin } from "../../../../utils/requireCompany";

export const updateDienstPartial: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { assignments } = req.body;

  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const result = await assignmentsService.updateDienstPartial(
      id,
      assignments,
      companyResult.companyId,
    );
    if (!result?.dienst) {
      res.status(404).json({ message: "Dienst no encontrado." });
      return;
    }
    const plain =
      typeof (result.dienst as { toJSON?: () => unknown }).toJSON === "function"
        ? (result.dienst as { toJSON: () => Record<string, unknown> }).toJSON()
        : (result.dienst as unknown as Record<string, unknown>);
    res.json({
      ...plain,
      ...(result.minimumRestWarning
        ? { minimumRestWarning: result.minimumRestWarning }
        : {}),
    });
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
    console.error("Error al actualizar Dienst:", error);
    res.status(500).json({ message: "Error al actualizar Dienst" });
  }
};
