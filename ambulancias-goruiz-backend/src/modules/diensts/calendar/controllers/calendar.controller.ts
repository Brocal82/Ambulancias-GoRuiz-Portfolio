import { Request, Response } from "express";
import { RequestHandler } from "express";
import mongoose from "mongoose";
import { ZodError, z } from "zod";
import Dienst from "../../../../models/Dienst";
import { dienstQuerySchema } from "../../../../schemas/dienstQuerySchema";
import { buildDienstSearchQuery } from "../../../../utils/dienstQueryBuilder";

const idSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, {
  message: "ID no válido",
});

export const getAllDiensts: RequestHandler = async (req, res) => {
  try {
    const diensts = await Dienst.find()
      .populate(
        "assignments.driver",
        "name lastName pscheinExpiry ambulanceRole",
      )
      .populate(
        "assignments.medic",
        "name lastName pscheinExpiry ambulanceRole",
      )
      .populate(
        "assignments.ambulanceId",
        "ambulanceNumber brand modelName licensePlate",
      )
      .lean();
    res.status(200).json(diensts);
  } catch (error) {
    console.error("Error al obtener los Diensts:", error);
    res.status(500).json({ message: "Error al obtener los Diensts" });
  }
};

export const getDienstById = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);
    const dienst = await Dienst.findById(parsedId).populate(
      "assignments.driver assignments.medic assignments.ambulanceId",
    );
    if (!dienst) {
      res.status(404).json({ message: "Dienst no encontrado" });
      return;
    }
    res.status(200).json(dienst);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: "ID inválido", errors: error.errors });
    } else {
      res.status(500).json({ message: "Error al obtener el Dienst", error });
    }
  }
};

export const searchDienst = async (req: Request, res: Response) => {
  try {
    const parsedQuery = dienstQuerySchema.parse(req.query);
    const query = buildDienstSearchQuery(parsedQuery);

    const dienste = await Dienst.find(query).populate(
      "assignments.driver assignments.medic",
    );
    res.status(200).json(dienste);
    return;
  } catch (error) {
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({ message: "Parámetros inválidos", errors: error.errors });
      return;
    }
    res.status(500).json({ message: "Error al buscar Diensts", error });
    return;
  }
};

export const getDienstsByUser = async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const diensts = await Dienst.find({
      assignments: {
        $elemMatch: {
          $or: [
            { driver: new mongoose.Types.ObjectId(userId) },
            { medic: new mongoose.Types.ObjectId(userId) },
          ],
        },
      },
    })
      .populate("assignments.driver", "name lastName")
      .populate("assignments.medic", "name lastName");

    res.status(200).json(diensts);
  } catch (error) {
    console.error("Error fetching diensts:", error);
    res.status(500).json({ message: "Error fetching diensts", error });
  }
};
