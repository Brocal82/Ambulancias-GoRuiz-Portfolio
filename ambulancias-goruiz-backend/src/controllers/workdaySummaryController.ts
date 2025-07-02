//src/controllers/workdaySummaryController.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import Dienst from "../models/Dienst";
import Trip from "../models/Trip";
import WorkdaySummary from "../models/workdaySummary";
import { calculateEffectivePatients } from "../utils/prämienUtils";

/* ─────────────────────────────
 * CIERRE COMPLETO DEL DÍA
 * ───────────────────────────── */
export const createWorkdaySummary = async (req: Request, res: Response) => {
  try {
    const {
      date,
      assignmentId,
      vehicleNumber,
      initialKm,
      finalKm,
      trips,
      extraNote,
    } = req.body;

    if (!date || !assignmentId || !vehicleNumber || initialKm === undefined || finalKm === undefined) {
      res.status(400).json({ message: "Faltan campos obligatorios" });
      return
    }

    if (!Array.isArray(trips)) {
      res.status(400).json({ message: "El campo trips debe ser un array" });
      return
    }

    const assignmentObjectId = new mongoose.Types.ObjectId(assignmentId);
    const dienst = await Dienst.findOne({ "assignments._id": assignmentObjectId });

    if (!dienst) {
      res.status(404).json({ message: "Dienst no encontrado con ese assignmentId" });
      return
    }

    const assignment = dienst.assignments.find(a => a._id?.toString() === assignmentObjectId.toString());

    if (!assignment) {
      res.status(404).json({ message: "Asignación no encontrada" });
      return
    }

    const { driver, medic } = assignment;
    const totalEffectivePatients = calculateEffectivePatients(trips, date);
    const totalDienstKm = finalKm - initialKm;

    const newSummary = await WorkdaySummary.create({
      date,
      assignmentId,
      driver,
      medic,
      vehicleNumber,
      initialKm,
      finalKm,
      totalDienstKm,
      trips,
      extraNote,
      isFinalClosure: true,
      totalEffectivePatients,
    });

    if (trips.length > 0) {
      await Trip.updateMany(
        { _id: { $in: trips.map((t: any) => t._id) } },
        { $set: { sentInSummary: true } }
      );
    }

    res.status(201).json(newSummary);
  } catch (error) {
    console.error("❌ Error al guardar resumen del día:", error);
    res.status(500).json({ message: "Error al guardar el resumen del día" });
  }
};

/* ─────────────────────────────
 * CIERRE PARCIAL DEL DÍA
 * ───────────────────────────── */
export const submitPartialClosure = async (req: Request, res: Response) => {
  try {
    const {
      date,
      assignmentId,
      driver,
      medic,
      vehicleNumber,
      initialKm,
      finalKm,
      trips,
      partialClosureReason,
    } = req.body;

    if (
      !date ||
      !assignmentId ||
      !driver ||
      !medic ||
      !vehicleNumber ||
      initialKm === undefined ||
      finalKm === undefined ||
      !Array.isArray(trips) ||
      !partialClosureReason
    ) {
       res.status(400).json({ message: "Faltan datos para el cierre parcial." });
       return
    }

    const totalEffectivePatients = calculateEffectivePatients(trips, date);
    const totalDienstKm = finalKm - initialKm;

    const summary = new WorkdaySummary({
      date,
      assignmentId,
      driver,
      medic,
      vehicleNumber,
      initialKm,
      finalKm,
      totalDienstKm,
      trips,
      partialClosureReason,
      isFinalClosure: false,
      totalEffectivePatients,
    });

    await summary.save();

    if (trips.length > 0) {
      await Trip.updateMany(
        { _id: { $in: trips.map((t: any) => t._id) } },
        { $set: { sentInSummary: true } }
      );
    }

    res.status(201).json({ message: "Cierre parcial guardado correctamente." });
  } catch (error) {
    console.error("❌ Error al guardar cierre parcial:", error);
    res.status(500).json({ message: "Error al guardar el cierre parcial." });
  }
};
