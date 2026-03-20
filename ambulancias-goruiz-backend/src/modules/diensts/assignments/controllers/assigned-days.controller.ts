import { RequestHandler } from "express";
import mongoose from "mongoose";
import Dienst from "../../../../models/Dienst";
import { AssignedDay } from "../../../../types/Dienst";
import { mapAssignmentToAssignedDay } from "../../utils/dienstMappers";

export const getAssignedDaysForUser: RequestHandler = async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    res.status(400).json({ message: "ID de usuario no válido" });
    return;
  }

  try {
    const diensts = await Dienst.find({
      $or: [
        { "assignments.driver": new mongoose.Types.ObjectId(userId) },
        { "assignments.medic": new mongoose.Types.ObjectId(userId) },
      ],
    })
      .populate("assignments.driver", "name lastName pscheinExpiry")
      .populate("assignments.medic", "name lastName pscheinExpiry")
      .populate("assignments.ambulanceId", "ambulanceNumber")
      .lean();

    const assignedDays: AssignedDay[] = [];

    diensts.forEach((dienst: { _id: unknown; dienstNumber: number; assignments: unknown[] }) => {
      dienst.assignments.forEach((assignment) => {
        const mapped = mapAssignmentToAssignedDay(assignment, dienst, userId);
        if (mapped) assignedDays.push(mapped);
      });
    });

    res.status(200).json(assignedDays);
  } catch (error) {
    console.error("❌ Error al obtener días asignados:", error);
    res.status(500).json({ message: "Error al obtener días asignados" });
  }
};
