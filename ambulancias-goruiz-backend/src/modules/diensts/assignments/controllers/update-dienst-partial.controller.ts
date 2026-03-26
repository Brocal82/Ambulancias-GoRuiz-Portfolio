import { RequestHandler } from "express";
import * as assignmentsService from "../services/assignments.service";
import { DienstAssignmentError } from "../services/assignment-errors";

export const updateDienstPartial: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { assignments } = req.body;

  try {
    const dienst = await assignmentsService.updateDienstPartial(
      id,
      assignments,
      req.companyId ?? undefined,
    );
    if (!dienst) {
      res.status(404).json({ message: "Dienst no encontrado." });
      return;
    }
    res.json(dienst);
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
