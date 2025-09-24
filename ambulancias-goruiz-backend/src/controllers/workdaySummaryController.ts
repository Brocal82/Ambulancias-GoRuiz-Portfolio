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

    // ✅ Validación con detalle
    const missing: string[] = [];
    if (!date) missing.push("date");
    if (!assignmentId) missing.push("assignmentId");
    if (!ambulanceId) missing.push("ambulanceId");
    if (initialKm === undefined) missing.push("initialKm");
    if (finalKm === undefined) missing.push("finalKm");
    if (!Array.isArray(trips)) missing.push("trips (debe ser array)");

    if (missing.length) {
      res.status(400).json({ message: `Faltan campos obligatorios: ${missing.join(", ")}` });
      return;
    }

    // ✅ Normalizaciones defensivas
    const nInitialKm = typeof initialKm === "string" ? Number(initialKm) : initialKm;
    const nFinalKm = typeof finalKm === "string" ? Number(finalKm) : finalKm;

    const sanitizedTrips = (trips as any[]).map((t) => ({
      ...t,
      wasCancelled: !!t.wasCancelled,
      cancelledAtPickup: !!t.cancelledAtPickup,
      countsTrip: typeof t.countsTrip === "number" ? (t.countsTrip === 1 ? 1 : 0) : 1,
    }));

    // 🔎 Busca Dienst/horarios como antes (ObjectId)
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

    // 🧮 Cálculos
    const totalEffectivePatients = calculateEffectivePatients(sanitizedTrips, date);
    const totalDienstKm = nFinalKm - nInitialKm;
    const totalRealTrips = sanitizedTrips.filter((t: any) => !t.wasCancelled || t.cancelledAtPickup).length;

    const newSummary = await WorkdaySummary.create({
      date,
      assignmentId,
      ambulanceId,
      ambulanceNumber,
      driver,
      medic,
      initialKm: nInitialKm,
      finalKm: nFinalKm,
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

    if (sanitizedTrips.length > 0) {
      const ids = sanitizedTrips.map((t: any) => t._id).filter(Boolean);
      if (ids.length > 0) {
        await Trip.updateMany({ _id: { $in: ids } }, { $set: { sentInSummary: true } });
      }
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
// backend/src/controllers/workdaySummaryController.ts
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

    // ✅ Validación detallada
    const missing: string[] = [];
    if (!date) missing.push("date");
    if (!assignmentId) missing.push("assignmentId");
    if (!driver) missing.push("driver");
    if (!medic) missing.push("medic");
    if (!ambulanceId) missing.push("ambulanceId");
    if (initialKm === undefined) missing.push("initialKm");
    if (finalKm === undefined) missing.push("finalKm");
    if (!Array.isArray(trips)) missing.push("trips (debe ser array)");
    if (!partialClosureReason || (typeof partialClosureReason === "string" && partialClosureReason.trim() === "")) {
      missing.push("partialClosureReason");
    }
    if (missing.length) {
      res.status(400).json({ message: `Faltan campos: ${missing.join(", ")}` });
      return;
    }

    // ✅ Normalizaciones defensivas
    const nInitialKm = typeof initialKm === "string" ? Number(initialKm) : initialKm;
    const nFinalKm = typeof finalKm === "string" ? Number(finalKm) : finalKm;

    const sanitizedTrips = (trips as any[]).map((t) => ({
      ...t,
      wasCancelled: !!t.wasCancelled,
      cancelledAtPickup: !!t.cancelledAtPickup,
      countsTrip: typeof t.countsTrip === "number" ? (t.countsTrip === 1 ? 1 : 0) : 1,
    }));

    // 🔎 Enriquecer con horario/dienstNumber si es posible
    let dienstNumber: number | null = null;
    let startTime: string | null = null;
    let endTime: string | null = null;

    try {
      const assignmentObjectId = new mongoose.Types.ObjectId(assignmentId);
      const dienst = await Dienst.findOne({ "assignments._id": assignmentObjectId });
      const assignment = dienst?.assignments.find(a => a._id?.toString() === assignmentObjectId.toString());
      dienstNumber = dienst?.dienstNumber ?? null;
      startTime = assignment?.startTime ?? null;
      endTime = assignment?.endTime ?? null;
    } catch {
      // si no es ObjectId válido, seguimos sin bloquear
    }

    // 🧮 Cálculos
    const totalEffectivePatients = calculateEffectivePatients(sanitizedTrips, date);
    const totalDienstKm = nFinalKm - nInitialKm;
    const totalRealTrips = sanitizedTrips.filter((t: any) => !t.wasCancelled || t.cancelledAtPickup).length;

    const summary = new WorkdaySummary({
      date,
      assignmentId,
      driver,
      medic,
      ambulanceId,
      ambulanceNumber,
      initialKm: nInitialKm,
      finalKm: nFinalKm,
      totalDienstKm,
      trips: sanitizedTrips,
      partialClosureReason: typeof partialClosureReason === "string" ? partialClosureReason.trim() : partialClosureReason,
      isFinalClosure: false,
      totalEffectivePatients,
      totalRealTrips,
      dienstNumber,
      startTime,
      endTime,
    });

    await summary.save();

    if (sanitizedTrips.length > 0) {
      const ids = sanitizedTrips.map((t: any) => t._id).filter(Boolean);
      if (ids.length > 0) {
        await Trip.updateMany({ _id: { $in: ids } }, { $set: { sentInSummary: true } });
      }
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

export const getSummariesCountByStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawStatus = typeof req.query.status === 'string' ? req.query.status : 'pending';
    const status = rawStatus.toLowerCase();

    let count = 0;

    if (status === 'pending') {
      // Definición amplia de "pendiente":
      // - status === 'pending'
      // - reviewStatus === 'pending'
      // - isReviewed === false
      // - O NO existen reviewStatus ni isReviewed (lo tratamos como no revisado)
      count = await WorkdaySummary.countDocuments({
        $or: [
          { status: 'pending' },
          { reviewStatus: 'pending' },
          { isReviewed: false },
          {
            $and: [
              { reviewStatus: { $exists: false } },
              { isReviewed: { $exists: false } },
            ],
          },
        ],
      });
    } else {
      // Para otros estados concretos, buscamos por status o reviewStatus
      count = await WorkdaySummary.countDocuments({
        $or: [{ status }, { reviewStatus: status }],
      });
    }

    res.status(200).json({ count });
  } catch (error) {
    console.error('❌ Error al contar summaries por estado:', error);
    res.status(500).json({ message: 'Error al contar resúmenes' });
  }
};

/**
 * PATCH /workday-summary/:id/review
 * Marca el resumen como revisado (isReviewed=true) y setea reviewedAt=now.
 * Responde el documento actualizado.
 */
export const markSummaryReviewed = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: 'ID inválido' });
      return;
    }

    const updated = await WorkdaySummary.findByIdAndUpdate(
      id,
      { $set: { isReviewed: true, reviewedAt: new Date() } },
      { new: true }
    );

    if (!updated) {
      res.status(404).json({ message: 'Resumen no encontrado' });
      return;
    }

    res.status(200).json(updated);
  } catch (error) {
    console.error('❌ Error al marcar resumen como revisado:', error);
    res.status(500).json({ message: 'Error al marcar resumen como revisado' });
  }
};



