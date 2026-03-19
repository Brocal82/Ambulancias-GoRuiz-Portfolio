// backend/src/controllers/tripController.ts

import { Request, Response } from "express";
import Trip from "../models/Trip";

// POST /api/trips → Crear un viaje
export const createTrip = async (req: Request, res: Response) => {
  try {
    const data = {
      ...req.body,
      countsTrip: req.body.countsTrip === undefined ? 1 : req.body.countsTrip,
    };

    // 👇 Lógica segura para calcular totalKm
    let totalKm = 0;

    if (!data.wasCancelled) {
      if (typeof data.kmStart === "number" && typeof data.kmEnd === "number") {
        totalKm = data.kmEnd - data.kmStart;
      }
    } else if (data.wasCancelled && data.countsTrip === 1) {
      totalKm = 0; // Cancelado pero cuenta → se guarda 0 km
    } else {
      totalKm = 0; // Cancelado y no cuenta → también 0 km
    }

    const newTrip = new Trip({
      ...data,
      totalKm,
    });

    const savedTrip = await newTrip.save();
    res.status(201).json(savedTrip);
  } catch (error) {
    console.error("❌ Error al crear el viaje:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

// GET /api/trips/date/:date → Obtener viajes por fecha (solo los no enviados)
export const getTripsByDate = async (req: Request, res: Response) => {
  const { date } = req.params;

  try {
    const trips = await Trip.find({
      date,
      sentInSummary: false, // ✅ Solo viajes que aún no se han enviado en resumen
    }).sort({ timeWarning: 1 }); // orden opcional si lo usas

    res.status(200).json(trips);
  } catch (error) {
    console.error("❌ Error al obtener viajes por fecha:", error);
    res.status(500).json({ message: "Error al obtener viajes" });
  }
};
