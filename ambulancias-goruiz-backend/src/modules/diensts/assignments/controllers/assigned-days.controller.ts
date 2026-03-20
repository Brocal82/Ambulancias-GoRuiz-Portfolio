import { RequestHandler } from "express";
import mongoose from "mongoose";
import * as assignmentsService from "../services/assignments.service";

export const getAssignedDaysForUser: RequestHandler = async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    res.status(400).json({ message: "ID de usuario no válido" });
    return;
  }

  try {
    const assignedDays = await assignmentsService.getAssignedDaysForUser(userId);
    res.status(200).json(assignedDays);
  } catch (error) {
    console.error("❌ Error al obtener días asignados:", error);
    res.status(500).json({ message: "Error al obtener días asignados" });
  }
};
