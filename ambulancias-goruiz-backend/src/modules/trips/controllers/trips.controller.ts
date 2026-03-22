import { Request, Response } from "express";
import * as tripsService from "../services/trips.service";

export const createTrip = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const savedTrip = await tripsService.createTrip(req.body);
    res.status(201).json(savedTrip);
  } catch (error) {
    console.error("❌ Error al crear el viaje:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const getTripsByDate = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { date } = req.params;
    const trips = await tripsService.getTripsByDate(date);
    res.status(200).json(trips);
  } catch (error) {
    console.error("❌ Error al obtener viajes por fecha:", error);
    res.status(500).json({ message: "Error al obtener viajes" });
  }
};
