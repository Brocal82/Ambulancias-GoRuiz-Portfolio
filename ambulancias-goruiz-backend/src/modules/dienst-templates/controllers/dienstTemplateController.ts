// backend/src/modules/dienst-templates/controllers/dienstTemplateController.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import DienstTemplate, {
  IDienstTemplate,
} from "../models/DienstTemplate";
import { requireCompanyForAdmin } from "../../../utils/requireCompany";

/**
 * GET /dienst-templates
 * Lista plantillas de Dienst de la empresa del admin
 */
export const getDienstTemplates = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }

    const templates: IDienstTemplate[] = await DienstTemplate.find({
      companyId: new mongoose.Types.ObjectId(companyResult.companyId),
    }).sort({
      dienstNumber: 1,
    });
    res.status(200).json(templates);
  } catch (error) {
    console.error("Error al obtener plantillas de Dienst:", error);
    res
      .status(500)
      .json({ message: "Error al obtener las plantillas de Dienst" });
  }
};

/**
 * POST /dienst-templates
 * Crea una nueva plantilla de Dienst
 */
export const createDienstTemplate = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }

    const {
      dienstNumber,
      startTime,
      endTime,
      daysOff,
      isActive,
      perDaySchedule,
    } = req.body;

    if (
      dienstNumber == null ||
      !startTime ||
      !endTime ||
      !Array.isArray(daysOff)
    ) {
      res.status(400).json({
        message: "dienstNumber, startTime, endTime y daysOff son obligatorios",
      });
      return;
    }

    let perDayScheduleToSave = undefined;
    if (perDaySchedule !== undefined) {
      if (!Array.isArray(perDaySchedule)) {
        res.status(400).json({
          message: "perDaySchedule debe ser un array si se envía",
        });
        return;
      }
      perDayScheduleToSave = perDaySchedule;
    }

    const newTemplate = new DienstTemplate({
      companyId: new mongoose.Types.ObjectId(companyResult.companyId),
      dienstNumber,
      startTime,
      endTime,
      daysOff,
      isActive: isActive !== undefined ? isActive : true,
      perDaySchedule: perDayScheduleToSave,
    });

    const saved = await newTemplate.save();
    res.status(201).json(saved);
  } catch (error: any) {
    console.error("Error al crear plantilla de Dienst:", error);

    if (error.code === 11000) {
      res.status(409).json({
        message: "Ya existe una plantilla con ese número de Dienst",
      });
      return;
    }

    res.status(500).json({ message: "Error al crear la plantilla de Dienst" });
  }
};

/**
 * PUT /dienst-templates/:id
 * Actualiza una plantilla de Dienst
 */
export const updateDienstTemplate = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }

    const { id } = req.params;
    const {
      dienstNumber,
      startTime,
      endTime,
      daysOff,
      isActive,
      perDaySchedule,
    } = req.body;

    let perDayScheduleToSave = undefined;
    if (perDaySchedule !== undefined) {
      if (!Array.isArray(perDaySchedule)) {
        res.status(400).json({
          message: "perDaySchedule debe ser un array si se envía",
        });
        return;
      }
      perDayScheduleToSave = perDaySchedule;
    }

    const co = new mongoose.Types.ObjectId(companyResult.companyId);

    const updated = await DienstTemplate.findOneAndUpdate(
      { _id: id, companyId: co },
      {
        dienstNumber,
        startTime,
        endTime,
        daysOff,
        isActive,
        perDaySchedule: perDayScheduleToSave,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updated) {
      res.status(404).json({ message: "Plantilla de Dienst no encontrada" });
      return;
    }

    res.status(200).json(updated);
  } catch (error: any) {
    console.error("Error al actualizar plantilla de Dienst:", error);

    if (error.code === 11000) {
      res.status(409).json({
        message: "Ya existe otra plantilla con ese número de Dienst",
      });
      return;
    }

    res
      .status(500)
      .json({ message: "Error al actualizar la plantilla de Dienst" });
  }
};

/**
 * DELETE /dienst-templates/:id
 * Elimina una plantilla de Dienst
 */
export const deleteDienstTemplate = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }

    const { id } = req.params;
    const co = new mongoose.Types.ObjectId(companyResult.companyId);

    const deleted = await DienstTemplate.findOneAndDelete({ _id: id, companyId: co });

    if (!deleted) {
      res.status(404).json({ message: "Plantilla de Dienst no encontrada" });
      return;
    }

    res
      .status(200)
      .json({ message: "Plantilla de Dienst eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar plantilla de Dienst:", error);
    res
      .status(500)
      .json({ message: "Error al eliminar la plantilla de Dienst" });
  }
};
