import { Request, Response } from "express";
import WorkdaySummary from "../models/workdaySummary";
import Dienst from "../models/Dienst";
import mongoose from "mongoose";

export const createWorkdaySummary = async (req: Request, res: Response) => {
  try {
    const { date, assignmentId, vehicleNumber, initialKm, finalKm, trips } = req.body;

    if (!date || !assignmentId || !vehicleNumber || initialKm === undefined || finalKm === undefined) {
      res.status(400).json({ message: "Faltan campos obligatorios" });
      return;
    }

    if (!Array.isArray(trips) || trips.length === 0) {
      res.status(400).json({ message: "Debes enviar al menos un viaje en el resumen (trips)" });
      return;
    }


    const assignmentObjectId = new mongoose.Types.ObjectId(assignmentId);

    const dienst = await Dienst.findOne({ "assignments._id": assignmentObjectId });

    if (!dienst) {
      res.status(404).json({ message: "Dienst no encontrado con ese assignmentId" });
      return;
    }

    const assignment = dienst.assignments.find(a =>
      a._id?.toString() === assignmentObjectId.toString()
    );

    if (!assignment) {
      res.status(404).json({ message: "Asignación no encontrada" });
      return;
    }

    const { driver, medic } = assignment;

    const newSummary = await WorkdaySummary.create({
      date,
      assignmentId,
      driver,
      medic,
      vehicleNumber,
      initialKm,
      finalKm,
      trips,
    });

    res.status(201).json(newSummary);
  } catch (error) {
    console.error("❌ Error al guardar resumen del día:", error);
    res.status(500).json({ message: "Error al guardar el resumen del día" });
  }
};

export const submitPartialClosure = async (req: Request, res: Response) => {
  try {
    const {
      date,
      assignmentId,
      driver,               // ✅ nuevo
      medic,                // ✅ nuevo
      vehicleNumber,
      initialKm,
      finalKm,              // ✅ nuevo obligatorio
      trips,
      totalTripKm,          // ✅ nuevo obligatorio
      partialClosureReason,
    } = req.body;

    // Validación de campos obligatorios
    if (
      !date ||
      !assignmentId ||
      !driver ||
      !medic ||
      !vehicleNumber ||
      !initialKm ||
      !finalKm ||
      !trips?.length ||
      !totalTripKm ||
      !partialClosureReason
    ) {
      return res.status(400).json({ message: "Faltan datos para el cierre parcial." });
    }

    // Crear resumen parcial
    const summary = new WorkdaySummary({
      date,
      assignmentId,
      driver,
      medic,
      vehicleNumber,
      initialKm,
      finalKm,
      trips,
      totalTripKm,
      partialClosureReason,
      isFinalClosure: false,
    });

    await summary.save();

    res.status(201).json({ message: "Cierre parcial guardado correctamente." });
  } catch (error) {
    console.error("❌ Error al guardar cierre parcial:", error);
    res.status(500).json({ message: "Error al guardar el cierre parcial." });
  }
};

