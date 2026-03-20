import { Request, Response } from "express";
import { RequestHandler } from "express";
import { ZodError, z } from "zod";
import { dienstQuerySchema } from "../../schemas/dienstQuerySchema";
import * as calendarService from "../services/calendar.service";

const idSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, {
  message: "ID no válido",
});

export const getAllDiensts: RequestHandler = async (_req, res) => {
  try {
    const diensts = await calendarService.getAllDiensts();
    res.status(200).json(diensts);
  } catch (error) {
    console.error("Error al obtener los Diensts:", error);
    res.status(500).json({ message: "Error al obtener los Diensts" });
  }
};

export const getDienstById = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);
    const dienst = await calendarService.getDienstById(parsedId);
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
    const dienste = await calendarService.searchDienst(parsedQuery);
    res.status(200).json(dienste);
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
    const diensts = await calendarService.getDienstsByUser(userId);
    res.status(200).json(diensts);
  } catch (error) {
    console.error("Error fetching diensts:", error);
    res.status(500).json({ message: "Error fetching diensts", error });
  }
};
