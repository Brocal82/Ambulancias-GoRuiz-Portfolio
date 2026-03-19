import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import SickLeave from "../models/sick-leave.model";
import { toBerlinDay } from "../utils/sick-date.helpers";
import { acceptSickLeaveWorkflow } from "../services/sick-acceptance.service";
import {
  createSickLeaveRecord,
  getSickLeaveById,
  rejectSickLeaveRecord,
} from "../services/sick-leaves-write.service";

const createSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(1000).optional(),
  documentUrl: z.string().url().optional(),
  user: z.string().optional(), // admin creando para otro usuario
});

export const sickLeaveCreateSchema = createSchema;

export async function createSickLeave(req: Request, res: Response) {
  try {
    const parsed = req.body as z.infer<typeof createSchema>;
    const userId = req.userId || parsed.user;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ message: "Usuario no v\u00E1lido" });
      return;
    }

    const start = toBerlinDay(parsed.startDate, false);
    const end = toBerlinDay(parsed.endDate, true);

    if (end < start) {
      res
        .status(400)
        .json({
          message: "El rango de fechas es inv\u00E1lido (endDate < startDate)",
        });
      return;
    }

    const doc = await createSickLeaveRecord({
      userId,
      startDate: start,
      endDate: end,
      note: parsed.note,
      documentUrl: parsed.documentUrl,
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error("\u274C createSickLeave error:", err);
    res.status(500).json({ message: "Error al crear la baja" });
  }
}

export async function acceptSickLeave(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "ID inv\u00E1lido" });
      return;
    }

    const sick = await SickLeave.findById(id);
    if (!sick) {
      res.status(404).json({ message: "Baja no encontrada" });
      return;
    }
    if (sick.status === "accepted") {
      res.status(409).json({ message: "La baja ya est\u00E1 aceptada" });
      return;
    }

    const result = await acceptSickLeaveWorkflow(sick);
    if (result.kind === "invalid_range") {
      res
        .status(400)
        .json({ message: "El rango de fechas de la baja es inv\u00E1lido" });
      return;
    }

    res.status(200).json(result.response);
  } catch (err) {
    console.error("\u274C acceptSickLeave error:", err);
    res.status(500).json({ message: "Error al aceptar la baja" });
  }
}

export async function rejectSickLeave(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "ID inv\u00E1lido" });
      return;
    }

    const sick = await getSickLeaveById(id);
    if (!sick) {
      res.status(404).json({ message: "Baja no encontrada" });
      return;
    }

    if (sick.status === "rejected") {
      res.status(409).json({ message: "La baja ya est\u00E1 rechazada" });
      return;
    }

    await rejectSickLeaveRecord(sick);

    res.status(200).json({
      message: "Baja rechazada",
      sickLeaveId: sick._id,
      status: sick.status,
    });
  } catch (err) {
    console.error("\u274C rejectSickLeave error:", err);
    res.status(500).json({ message: "Error al rechazar la baja" });
  }
}
