// backend/src/modules/dienst-templates/controllers/dienstTemplateController.ts
import { Request, Response } from "express";
import DienstTemplate, {
  IDienstTemplate,
} from "../models/DienstTemplate";

/**
 * GET /dienst-templates
 * Lista todas las plantillas de Dienst
 */
export const getDienstTemplates = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const templates: IDienstTemplate[] = await DienstTemplate.find().sort({
      dienstNumber: 1,
    });
    res.status(200).json(templates);
  } catch (error) {
    console.error("âŒ Error al obtener plantillas de Dienst:", error);
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

    // Si viene perDaySchedule, comprobamos que sea un array bÃ¡sico.
    let perDayScheduleToSave = undefined;
    if (perDaySchedule !== undefined) {
      if (!Array.isArray(perDaySchedule)) {
        res.status(400).json({
          message: "perDaySchedule debe ser un array si se envÃ­a",
        });
        return;
      }
      perDayScheduleToSave = perDaySchedule;
    }

    const newTemplate = new DienstTemplate({
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
    console.error("âŒ Error al crear plantilla de Dienst:", error);

    if (error.code === 11000) {
      // conflicto por unique index (dienstNumber)
      res.status(409).json({
        message: "Ya existe una plantilla con ese nÃºmero de Dienst",
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
    const { id } = req.params;
    const {
      dienstNumber,
      startTime,
      endTime,
      daysOff,
      isActive,
      perDaySchedule,
    } = req.body;

    // Igual que en create: solo validaciÃ³n bÃ¡sica de perDaySchedule si viene
    let perDayScheduleToSave = undefined;
    if (perDaySchedule !== undefined) {
      if (!Array.isArray(perDaySchedule)) {
        res.status(400).json({
          message: "perDaySchedule debe ser un array si se envÃ­a",
        });
        return;
      }
      perDayScheduleToSave = perDaySchedule;
    }

    const updated = await DienstTemplate.findByIdAndUpdate(
      id,
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
    console.error("âŒ Error al actualizar plantilla de Dienst:", error);

    if (error.code === 11000) {
      res.status(409).json({
        message: "Ya existe otra plantilla con ese nÃºmero de Dienst",
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
    const { id } = req.params;

    const deleted = await DienstTemplate.findByIdAndDelete(id);

    if (!deleted) {
      res.status(404).json({ message: "Plantilla de Dienst no encontrada" });
      return;
    }

    res
      .status(200)
      .json({ message: "Plantilla de Dienst eliminada correctamente" });
  } catch (error) {
    console.error("âŒ Error al eliminar plantilla de Dienst:", error);
    res
      .status(500)
      .json({ message: "Error al eliminar la plantilla de Dienst" });
  }
};
