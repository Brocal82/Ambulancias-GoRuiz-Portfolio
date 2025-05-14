import { Request, Response } from 'express';
import Dienst from '../models/Dienst';
import { dienstSchema } from '../schemas/dienstSchema';
import { ZodError } from 'zod';

export const createDienst = async (req: Request, res: Response) => {
  try {
    // Validamos los datos usando Zod
    const parsedData = dienstSchema.parse(req.body);

    // Si la validación pasa, creamos y guardamos el Dienst
    const newDienst = new Dienst(parsedData);
    const savedDienst = await newDienst.save();

    res.status(201).json(savedDienst);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errors: error.errors,
      });
    }

    res.status(500).json({ message: 'Error al crear Dienst', error });
  }
};
