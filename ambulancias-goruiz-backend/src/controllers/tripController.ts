// backend/src/controllers/tripController.ts

import { Request, Response } from 'express';
import Trip from '../models/Trip';
import { tripSchema } from '../schemas/tripSchema';
import { ZodError } from 'zod';

// POST /api/trips → Crear un viaje
export const createTrip = async (req: Request, res: Response) => {
  try {
    const parsedData = tripSchema.parse(req.body);
    const newTrip = new Trip(parsedData);
    const savedTrip = await newTrip.save();
    res.status(201).json(savedTrip);
  } catch (error) {
    if (error instanceof ZodError) {
      console.error('Validation errors:', error.errors);
       res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
       return
    }
    console.error('❌ Error al crear el viaje:', error);
    res.status(500).json({ message: 'Error al crear el viaje' });
  }
};

// GET /api/trips/date/:date → Obtener viajes por fecha
export const getTripsByDate = async (req: Request, res: Response) => {
  const { date } = req.params;

  try {
    const trips = await Trip.find({ date });
    res.status(200).json(trips);
  } catch (error) {
    console.error('❌ Error al obtener viajes por fecha:', error);
    res.status(500).json({ message: 'Error al obtener viajes' });
  }
};

