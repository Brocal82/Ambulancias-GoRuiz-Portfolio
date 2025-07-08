//src/controllers/workdaySummaryController.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import Dienst from "../models/Dienst";
import Trip from "../models/Trip";
import WorkdaySummary from "../models/workdaySummary";
import { calculateEffectivePatients } from "../utils/prämienUtils";

/* ─────────────────────────────s
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

    console.log("📦 Trips recibidos en createWorkdaySummary:");
    trips.forEach((trip: any, index: number) => {
      console.log(`  🚑 Trip ${index + 1}:`, {
        auftragNumber: trip.auftragNumber,
        wasCancelled: trip.wasCancelled,
        cancelledAtPickup: trip.cancelledAtPickup
      });
    });


    const dienstNumber = dienst?.dienstNumber ?? null;
    const startTime = assignment?.startTime ?? null;
    const endTime = assignment?.endTime ?? null;

    const { driver, medic } = assignment;

    const totalEffectivePatients = calculateEffectivePatients(trips, date);
    const totalDienstKm = finalKm - initialKm;
    const totalRealTrips = trips.filter(t => {
      const wasCancelled = t.wasCancelled === true;
      const cancelledAtPickup = t.cancelledAtPickup === true;
      return !wasCancelled || cancelledAtPickup;
    }).length;


    console.log("✅ totalRealTrips calculado:", totalRealTrips);




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
      totalRealTrips,
      dienstNumber,
      startTime,
      endTime,
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

    const dienst = await Dienst.findOne({ "assignments._id": assignmentId });
    const assignment = dienst?.assignments.find(a => a._id?.toString() === assignmentId);

    const dienstNumber = dienst?.dienstNumber ?? null;
    const startTime = assignment?.startTime ?? null;
    const endTime = assignment?.endTime ?? null;

    const totalEffectivePatients = calculateEffectivePatients(trips, date);
    const totalDienstKm = finalKm - initialKm;

    const totalRealTrips = trips.filter(t => {
      const wasCancelled = t.wasCancelled === true;
      const cancelledAtPickup = t.cancelledAtPickup === true;
      return !wasCancelled || cancelledAtPickup;
    }).length;





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
      totalRealTrips,
      dienstNumber,
      startTime,
      endTime,
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


export const getAllWorkdaySummaries = async (req: Request, res: Response) => {
  try {
    const summaries = await WorkdaySummary.find()
      .sort({ date: -1 })
      .populate('driver', 'name lastName')
      .populate('medic', 'name lastName')
      .populate('trips')
      .lean();

    const diensts = await Dienst.find().lean();

    const enriched = summaries.map((s: any) => {
      const dienst = diensts.find(d =>
        d.assignments.some(a => a._id && a._id.toString() === s.assignmentId.toString())
      );

      const assignment = dienst?.assignments.find(
        a => a._id && a._id.toString() === s.assignmentId.toString()
      );

      return {
        ...s,
        dienstId: dienst?._id ?? null,
        dienstNumber: s.dienstNumber ?? dienst?.dienstNumber ?? null,
        startTime: s.startTime ?? assignment?.startTime ?? null,
        endTime: s.endTime ?? assignment?.endTime ?? null,
      };
    });

    res.status(200).json(enriched);
  } catch (error) {
    console.error("❌ Error al obtener resúmenes:", error);
    res.status(500).json({ message: "Error al obtener los resúmenes." });
  }
};






