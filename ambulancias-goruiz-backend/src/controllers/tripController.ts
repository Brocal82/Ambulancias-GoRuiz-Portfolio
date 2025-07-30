// backend/src/controllers/tripController.ts

import { Request, Response } from 'express';
import Trip from '../models/Trip';
import { tripSchema } from '../schemas/tripSchema';
import { ZodError } from 'zod';

// POST /api/trips → Crear un viaje
export const createTrip = async (req: Request, res: Response) => {
  try {
    const parsed = tripSchema.safeParse(req.body);

    if (!parsed.success) {
      console.warn("Validation errors:", parsed.error.errors);
      res.status(400).json({
        message: "Errores de validación",
        errors: parsed.error.errors.map((err) => ({
          field: err.path[0],
          message: err.message,
        })),
      });
      return;
    }

    const data = parsed.data;

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
      totalKm, // ← aseguramos que se guarda limpio
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
    console.error('❌ Error al obtener viajes por fecha:', error);
    res.status(500).json({ message: 'Error al obtener viajes' });
  }
};


