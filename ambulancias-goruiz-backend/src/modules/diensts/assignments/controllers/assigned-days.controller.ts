import { RequestHandler } from "express";
import { resolveAccessibleUserId } from "../../../../utils/resolveAccessibleUserId";
import * as assignmentsService from "../services/assignments.service";

export const getAssignedDaysForUser: RequestHandler = async (req, res) => {
  const result = resolveAccessibleUserId(req, req.params.userId);

  if (!result.ok) {
    res.status(result.statusCode).json({ message: result.message });
    return;
  }

  try {
    const assignedDays = await assignmentsService.getAssignedDaysForUser(
      result.userId,
    );
    res.status(200).json(assignedDays);
  } catch (error) {
    console.error("❌ Error al obtener días asignados:", error);
    res.status(500).json({ message: "Error al obtener días asignados" });
  }
};
