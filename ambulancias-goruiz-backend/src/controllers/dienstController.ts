import { Request, Response } from 'express';
import Dienst from '../models/Dienst';
import { dienstSchema } from '../schemas/dienstSchema';
import { ZodError, z } from 'zod';
import { partialDienstSchema } from '../schemas/dienstSchema';
import { dienstQuerySchema } from '../schemas/dienstQuerySchema'; // asegúrate de importar el schema

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
        res.status(400).json({
        message: 'Datos inválidos',
        errors: error.errors,
      });
      return
    }

    res.status(500).json({ message: 'Error al crear Dienst', error });
  }
};

export const getAllDiensts = async (req: Request, res: Response) => {
  try {
    const diensts = await Dienst.find(); // obtiene todos los documentos
    res.status(200).json(diensts);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los Diensts', error });
  }
};

// Validación del ID usando Zod
const idSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, {
  message: 'ID no válido. Debe ser un ObjectId de MongoDB.',
});

export const getDienstById = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);

    const dienst = await Dienst.findById(parsedId);

    if (!dienst) {
      res.status(404).json({ message: 'Dienst no encontrado' });
      return
    }
    

    res.status(200).json(dienst);
  } catch (error) {
    if (error instanceof ZodError) {
       res.status(400).json({
        message: 'ID inválido',
        errors: error.errors,
      });
      return
    }

    res.status(500).json({ message: 'Error al obtener el Dienst', error });
  }
};

export const updateDienst = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);
    const parsedData = dienstSchema.partial().parse(req.body); // actualizaciones parciales

    const updatedDienst = await Dienst.findByIdAndUpdate(parsedId, parsedData, {
      new: true,
    });

    if (!updatedDienst) {
      res.status(404).json({ message: 'Dienst no encontrado' });
      return
    }

    res.status(200).json(updatedDienst);
  } catch (error) {
    if (error instanceof ZodError) {
        res.status(400).json({
        message: 'Datos inválidos',
        errors: error.errors,
      });
      return
    }

    res.status(500).json({ message: 'Error al actualizar el Dienst', error });
  }
};

export const updateDienstPartial = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);
    const updates = partialDienstSchema.parse(req.body);

    const updatedDienst = await Dienst.findByIdAndUpdate(
      parsedId,
      { $set: updates },
      { new: true }
    );

    if (!updatedDienst) {
      res.status(404).json({ message: 'Dienst no encontrado' });
      return
    }

    res.status(200).json(updatedDienst);
  } catch (error) {
    if (error instanceof ZodError) {
        res.status(400).json({
        message: 'Datos inválidos para actualización parcial',
        errors: error.errors,
      });
      return
    }

    res.status(500).json({ message: 'Error al actualizar parcialmente el Dienst', error });
  }
};

export const deleteDienst = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);

    const deletedDienst = await Dienst.findByIdAndDelete(parsedId);

    if (!deletedDienst) {
      res.status(404).json({ message: 'Dienst no encontrado' });
      return
    }

      res.status(200).json({ message: 'Dienst eliminado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
        res.status(400).json({
        message: 'ID inválido',
        errors: error.errors,
      });
      return
    }

      res.status(500).json({ message: 'Error al eliminar el Dienst', error });
  }
};


export const searchDienst = async (req: Request, res: Response) => {
  try {
    const parsedQuery = dienstQuerySchema.parse(req.query);

    const query: any = {};

    if (parsedQuery.dienstNumber) {
      const num = parseInt(parsedQuery.dienstNumber, 10);
      if (!isNaN(num)) query.dienstNumber = num;
    }

    if (parsedQuery.weekStartDate) {
      query.weekStartDate = parsedQuery.weekStartDate;
    }

    if (parsedQuery.date) {
      query['assignments.date'] = parsedQuery.date;
    }

    if (parsedQuery.driver) {
      query['assignments.driver'] = parsedQuery.driver;
    }

    if (parsedQuery.medic) {
      query['assignments.medic'] = parsedQuery.medic;
    }

    const dienste = await Dienst.find(query);

    res.status(200).json(dienste);
  } catch (error) {
    if (error instanceof ZodError) {
        res.status(400).json({
        message: 'Parámetros de búsqueda inválidos',
        errors: error.errors,
      });
      return
    }

    res.status(500).json({ message: 'Error al buscar Diensts', error });
  }
};



