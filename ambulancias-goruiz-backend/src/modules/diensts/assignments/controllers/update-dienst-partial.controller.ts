import { RequestHandler } from "express";
import * as assignmentsService from "../services/assignments.service";

export const updateDienstPartial: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { assignments } = req.body;

  if (!assignments || !Array.isArray(assignments)) {
    res
      .status(400)
      .json({ message: "No se proporcionaron assignments válidos." });
    return;
  }

  try {
    const dienst = await assignmentsService.updateDienstPartial(id, assignments);
    if (!dienst) {
      res.status(404).json({ message: "Dienst no encontrado." });
      return;
    }
    res.json(dienst);
  } catch (error) {
    console.error("Error al actualizar Dienst:", error);
    res.status(500).json({ message: "Error al actualizar Dienst" });
  }
};
