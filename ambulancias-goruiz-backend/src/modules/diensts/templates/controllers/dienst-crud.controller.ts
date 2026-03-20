import { Request, Response } from "express";
import { ZodError, z } from "zod";
import Dienst from "../../../../models/Dienst";
import { dienstSchema } from "../../schemas/dienstSchema";

const idSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, {
  message: "ID no válido",
});

export const createDienst = async (req: Request, res: Response) => {
  try {
    const parsedData = dienstSchema.parse(req.body);
    const newDienst = new Dienst(parsedData);
    const savedDienst = await newDienst.save();
    res.status(201).json(savedDienst);
  } catch (error) {
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({ message: "Datos inválidos", errors: error.errors });
    } else {
      res.status(500).json({ message: "Error al crear Dienst", error });
    }
  }
};

export const updateDienst = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);
    const parsedData = dienstSchema.partial().parse(req.body);
    const updatedDienst = await Dienst.findByIdAndUpdate(parsedId, parsedData, {
      new: true,
    }).populate("assignments.driver assignments.medic assignments.ambulanceId");
    if (!updatedDienst) {
      res.status(404).json({ message: "Dienst no encontrado" });
      return;
    }
    res.status(200).json(updatedDienst);
  } catch (error) {
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({ message: "Datos inválidos", errors: error.errors });
    } else {
      res.status(500).json({ message: "Error al actualizar el Dienst", error });
    }
  }
};

export const deleteDienst = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);
    const deletedDienst = await Dienst.findByIdAndDelete(parsedId);
    if (!deletedDienst) {
      res.status(404).json({ message: "Dienst no encontrado" });
      return;
    }
    res.status(200).json({ message: "Dienst eliminado correctamente" });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: "ID inválido", errors: error.errors });
    } else {
      res.status(500).json({ message: "Error al eliminar el Dienst", error });
    }
  }
};
