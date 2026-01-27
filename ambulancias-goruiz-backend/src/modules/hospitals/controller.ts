// backend/src/modules/hospitals/controller.ts
import { Request, Response } from "express";
import * as hospitalsService from "./service";
import { normalizeUpdateHospital, validateCreateHospital } from "./validators";

export const getAllHospitals = async (_req: Request, res: Response) => {
  try {
    const hospitals = await hospitalsService.getAllHospitals();
    res.status(200).json(hospitals);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los hospitales" });
  }
};

export const createHospital = async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = validateCreateHospital(req.body);

    if (!validated.ok) {
      res.status(400).json({ message: validated.message });
      return;
    }

    const saved = await hospitalsService.createHospital(validated.value);
    res.status(201).json(saved);
  } catch (error) {
    console.error("Error al crear hospital:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const updateHospital = async (req: Request, res: Response) => {
  try {
    const updatedFields = normalizeUpdateHospital(req.body);
    console.log("🔧 Campos recibidos para actualizar:", updatedFields);

    const updated = await hospitalsService.updateHospital(req.params.id, updatedFields);

    if (!updated) {
      res.status(404).json({ message: "Hospital no encontrado" });
      return;
    }

    res.status(200).json(updated);
  } catch (error) {
    console.error("❌ Error al actualizar hospital:", error);
    res.status(400).json({ message: "Error al actualizar el hospital" });
  }
};

export const deleteHospital = async (req: Request, res: Response) => {
  try {
    await hospitalsService.deleteHospital(req.params.id);
    res.status(200).json({ message: "Hospital eliminado" });
  } catch (error) {
    res.status(400).json({ message: "Error al eliminar el hospital" });
  }
};
