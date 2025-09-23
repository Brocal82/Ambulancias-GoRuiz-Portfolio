//src/controllers/workdaySummaryController.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import Dienst from "../models/Dienst";
import Trip from "../models/Trip";
import WorkdaySummary from "../models/workdaySummary";
import WorkdayIssue from "../models/WorkdayIssue";
import { calculateEffectivePatients } from "../utils/prämienUtils";

/* ─────────────────────────────
 * CIERRE COMPLETO DEL DÍA
 * ───────────────────────────── */
export const createWorkdaySummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      date,
      assignmentId,
      ambulanceId,
      ambulanceNumber,
      initialKm,
      finalKm,
      trips,
      extraNote,
    } = req.body;

    if (!date || !assignmentId || !ambulanceId || initialKm === undefined || finalKm === undefined) {
      res.status(400).json({ message: "Faltan campos obligatorios" });
      return;
    }

    if (!Array.isArray(trips)) {
      res.status(400).json({ message: "El campo trips debe ser un array" });
      return;
    }

    const assignmentObjectId = new mongoose.Types.ObjectId(assignmentId);
    const dienst = await Dienst.findOne({ "assignments._id": assignmentObjectId });

    if (!dienst) {
      res.status(404).json({ message: "Dienst no encontrado con ese assignmentId" });
      return;
    }

    const assignment = dienst.assignments.find(a => a._id?.toString() === assignmentObjectId.toString());

    if (!assignment) {
      res.status(404).json({ message: "Asignación no encontrada" });
      return;
    }

    const dienstNumber = dienst?.dienstNumber ?? null;
    const startTime = assignment?.startTime ?? null;
    const endTime = assignment?.endTime ?? null;
    const { driver, medic } = assignment;

    // ✅ Asegura que countsTrip sea 0 o 1 (por defecto 1 si viene undefined)
    const sanitizedTrips = trips.map((t: any) => ({
      ...t,
      countsTrip: typeof t.countsTrip === "number" ? t.countsTrip : 1,
    }));

    const totalEffectivePatients = calculateEffectivePatients(sanitizedTrips, date);
    const totalDienstKm = finalKm - initialKm;
    const totalRealTrips = sanitizedTrips.filter((t: any) => !t.wasCancelled || t.cancelledAtPickup).length;

    const newSummary = await WorkdaySummary.create({
      date,
      assignmentId,
      ambulanceId,
      ambulanceNumber,
      driver,
      medic,
      initialKm,
      finalKm,
      totalDienstKm,
      trips: sanitizedTrips,
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
export const submitPartialClosure = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      date,
      assignmentId,
      driver,
      medic,
      ambulanceId,
      ambulanceNumber,
      initialKm,
      finalKm,
      trips,
      partialClosureReason,
    } = req.body;

    if (
      !date || !assignmentId || !driver || !medic ||
      !ambulanceId || initialKm === undefined || finalKm === undefined ||
      !Array.isArray(trips) || !partialClosureReason
    ) {
      res.status(400).json({ message: "Faltan datos para el cierre parcial." });
      return;
    }

    const dienst = await Dienst.findOne({ "assignments._id": assignmentId });
    const assignment = dienst?.assignments.find(a => a._id?.toString() === assignmentId);

    const dienstNumber = dienst?.dienstNumber ?? null;
    const startTime = assignment?.startTime ?? null;
    const endTime = assignment?.endTime ?? null;

    // ✅ Igual que arriba
    const sanitizedTrips = trips.map((t: any) => ({
      ...t,
      countsTrip: typeof t.countsTrip === "number" ? t.countsTrip : 1,
    }));

    const totalEffectivePatients = calculateEffectivePatients(sanitizedTrips, date);
    const totalDienstKm = finalKm - initialKm;
    const totalRealTrips = sanitizedTrips.filter((t: any) => !t.wasCancelled || t.cancelledAtPickup).length;

    const summary = new WorkdaySummary({
      date,
      assignmentId,
      driver,
      medic,
      ambulanceId,
      ambulanceNumber,
      initialKm,
      finalKm,
      totalDienstKm,
      trips: sanitizedTrips,
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



/* ─────────────────────────────
 * GET TODOS LOS RESÚMENES
 * ───────────────────────────── */
export const getAllWorkdaySummaries = async (req: Request, res: Response): Promise<void> => {
  try {
    const summaries = await WorkdaySummary.find()
      .sort({ date: -1 })
      .populate('driver', 'name lastName')
      .populate('medic', 'name lastName')
      .populate({
        path: 'trips',
        select: 'auftragNumber wasCancelled cancelledAtPickup countsTrip kmStart kmEnd timeWarning timeAtHome timePickup timeArrival timeEnd fromAddress toAddress patientName reports'
      })
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

/* ─────────────────────────────
 * AVERÍAS
 * ───────────────────────────── */
export const reportIssue = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      dienstNumber,
      date,
      startTime,
      endTime,
      team,
      ambulanceNumber,       // ✅ ahora usamos ambulanceNumber
      ambulanceId,
      finalKm,
      timestamp,
      issueText,
      driver,
      medic,
    } = req.body;

    // ✅ Validación con ambulanceNumber
    if (!dienstNumber || !ambulanceNumber || !ambulanceId || !timestamp || !issueText) {
      res.status(400).json({ message: "Faltan datos obligatorios para reporte de avería." });
      return;
    }

    if (driver && !mongoose.isValidObjectId(driver)) {
      res.status(400).json({ message: "driver no es un ObjectId válido" });
      return;
    }

    if (medic && !mongoose.isValidObjectId(medic)) {
      res.status(400).json({ message: "medic no es un ObjectId válido" });
      return;
    }

    const newIssue = await WorkdayIssue.create({
      dienstNumber,
      date,
      startTime,
      endTime,
      team,
      ambulanceNumber,   // ✅ actualizado
      ambulanceId,
      finalKm,
      timestamp,
      issueText,
      driver,
      medic,
    });

    res.status(201).json(newIssue);
  } catch (err) {
    console.error("❌ Error reportIssue:", err);
    res.status(500).json({ message: "Error interno al generar reporte de avería." });
  }
};


export const getAllIssueReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const issues = await WorkdayIssue.find().sort({ timestamp: -1 });
    res.status(200).json(issues);
  } catch (err) {
    console.error("❌ Error al obtener reportes técnicos:", err);
    res.status(500).json({ message: "Error al obtener reportes técnicos" });
  }
};

/* ─────────────────────────────
 * AVERÍAS: BORRAR REPORTE
 * ───────────────────────────── */
export const deleteIssueReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }

    const deleted = await WorkdayIssue.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404).json({ message: "Reporte no encontrado" });
      return;
    }

    res.status(200).json({ message: "Reporte eliminado correctamente" });
  } catch (err) {
    console.error("❌ Error al eliminar reporte técnico:", err);
    res.status(500).json({ message: "Error al eliminar el reporte técnico" });
  }
};

/**
 * GET /summaries/count?status=pending
 * Responde: { count: number }
 * - Conteo derivado del propio módulo, sin duplicar notificaciones.
 * - Flexible con el modelo: soporta status, reviewStatus o isReviewed (boolean).
 */
export const getSummariesCountByStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawStatus = typeof req.query.status === 'string' ? req.query.status : 'pending';
    const status = rawStatus.toLowerCase();

    // Construimos filtros compatibles con distintos esquemas
    const orFilters: any[] = [
      { status },          // si tuvieras WorkdaySummary.status = 'pending' | 'approved' | ...
      { reviewStatus: status }, // o si usas reviewStatus
    ];

    // Si interpretas "pendiente" como "no revisado"
    if (status === 'pending') {
      orFilters.push({ isReviewed: false });
    }

    // NOTA: en la mayoría de casos solo uno de estos campos existirá, así que no habrá doble conteo.
    const count = await WorkdaySummary.countDocuments({ $or: orFilters });

    res.status(200).json({ count });
  } catch (error) {
    console.error('❌ Error al contar summaries por estado:', error);
    res.status(500).json({ message: 'Error al contar resúmenes' });
  }
};


