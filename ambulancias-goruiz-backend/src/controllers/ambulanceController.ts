import { Request, Response } from "express";
import Ambulance from "../models/Ambulance";
import {
  createAmbulanceSchema,
  updateAmbulanceSchema,
} from "../schemas/ambulanceSchema";

// Obtener todas las ambulancias
export const getAllAmbulances = async (req: Request, res: Response) => {
  try {
    const ambulances = await Ambulance.find();
    res.status(200).json(ambulances);
  } catch (error) {
    console.error("Error fetching ambulances:", error);
    res.status(500).json({ message: "Error fetching ambulances" });
  }
};

// Obtener una ambulancia por ID
export const getAmbulanceById = async (req: Request, res: Response) => {
  try {
    const ambulance = await Ambulance.findById(req.params.id);
    if (!ambulance) {
      res.status(404).json({ message: "Ambulance not found" });
      return;
    }
    res.status(200).json(ambulance);
  } catch (error) {
    console.error("Error fetching ambulance:", error);
    res.status(500).json({ message: "Error fetching ambulance" });
  }
};

// Crear una nueva ambulancia
export const createAmbulance = async (req: Request, res: Response) => {
  try {
    const parsed = createAmbulanceSchema.safeParse(req.body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      const message =
        firstError?.path?.length > 0
          ? `${firstError.path.join(".")}: ${firstError.message}`
          : firstError?.message ?? "Datos inválidos";
      res.status(400).json({ message });
      return;
    }

    const newAmbulance = new Ambulance(parsed.data);
    await newAmbulance.save();
    res.status(201).json(newAmbulance);
  } catch (error: unknown) {
    if (isMongoDuplicateKeyError(error)) {
      res.status(400).json({
        message: "Ya existe una ambulancia con esa matrícula o número",
      });
      return;
    }
    console.error("Error creating ambulance:", error);
    res.status(500).json({ message: "Error creating ambulance" });
  }
};

// Actualizar una ambulancia existente
export const updateAmbulance = async (req: Request, res: Response) => {
  try {
    const parsed = updateAmbulanceSchema.safeParse(req.body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      const message =
        firstError?.path?.length > 0
          ? `${firstError.path.join(".")}: ${firstError.message}`
          : firstError?.message ?? "Datos inválidos";
      res.status(400).json({ message });
      return;
    }

    const updated = await Ambulance.findByIdAndUpdate(
      req.params.id,
      parsed.data,
      { new: true },
    );
    if (!updated) {
      res.status(404).json({ message: "Ambulance not found" });
      return;
    }
    res.status(200).json(updated);
  } catch (error: unknown) {
    if (isMongoDuplicateKeyError(error)) {
      res.status(400).json({
        message: "Ya existe una ambulancia con esa matrícula o número",
      });
      return;
    }
    console.error("Error updating ambulance:", error);
    res.status(500).json({ message: "Error updating ambulance" });
  }
};

function isMongoDuplicateKeyError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

// Eliminar una ambulancia
export const deleteAmbulance = async (req: Request, res: Response) => {
  try {
    const deleted = await Ambulance.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ message: "Ambulance not found" });
      return;
    }
    res.status(200).json({ message: "Ambulance deleted" });
  } catch (error) {
    console.error("Error deleting ambulance:", error);
    res.status(500).json({ message: "Error deleting ambulance" });
  }
};
