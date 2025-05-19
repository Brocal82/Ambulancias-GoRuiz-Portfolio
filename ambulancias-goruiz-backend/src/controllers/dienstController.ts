import { Request, Response } from 'express';
import Dienst from '../models/Dienst';
import { dienstSchema, partialDienstSchema } from '../schemas/dienstSchema';
import { dienstQuerySchema } from '../schemas/dienstQuerySchema';
import { ZodError, z } from 'zod';

const idSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, {
  message: 'ID no válido',
});

export const createDienst = async (req: Request, res: Response) => {
  try {
    const parsedData = dienstSchema.parse(req.body);
    const newDienst = new Dienst(parsedData);
    const savedDienst = await newDienst.save();
    res.status(201).json(savedDienst);
    return;
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      return;
    }
    res.status(500).json({ message: 'Error al crear Dienst', error });
    return;
  }
};

export const getAllDiensts = async (_req: Request, res: Response) => {
  try {
    const diensts = await Dienst.find().populate('assignments.driver assignments.medic');
    res.status(200).json(diensts);
    return;
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los Diensts', error });
    return;
  }
};

export const getDienstById = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);
    const dienst = await Dienst.findById(parsedId).populate('assignments.driver assignments.medic');
    if (!dienst) {
      res.status(404).json({ message: 'Dienst no encontrado' });
      return;
    }
    res.status(200).json(dienst);
    return;
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: 'ID inválido', errors: error.errors });
      return;
    }
    res.status(500).json({ message: 'Error al obtener el Dienst', error });
    return;
  }
};

export const updateDienst = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);
    const parsedData = dienstSchema.partial().parse(req.body);
    const updatedDienst = await Dienst.findByIdAndUpdate(parsedId, parsedData, { new: true })
      .populate('assignments.driver assignments.medic');
    if (!updatedDienst) {
      res.status(404).json({ message: 'Dienst no encontrado' });
      return;
    }
    res.status(200).json(updatedDienst);
    return;
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      return;
    }
    res.status(500).json({ message: 'Error al actualizar el Dienst', error });
    return;
  }
};

export const updateDienstPartial = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);
    const updates = partialDienstSchema.parse(req.body);
    const updatedDienst = await Dienst.findByIdAndUpdate(parsedId, { $set: updates }, { new: true })
      .populate('assignments.driver assignments.medic');
    if (!updatedDienst) {
      res.status(404).json({ message: 'Dienst no encontrado' });
      return;
    }
    res.status(200).json(updatedDienst);
    return;
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      return;
    }
    res.status(500).json({ message: 'Error al actualizar parcialmente el Dienst', error });
    return;
  }
};

export const deleteDienst = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);
    const deletedDienst = await Dienst.findByIdAndDelete(parsedId);
    if (!deletedDienst) {
      res.status(404).json({ message: 'Dienst no encontrado' });
      return;
    }
    res.status(200).json({ message: 'Dienst eliminado correctamente' });
    return;
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: 'ID inválido', errors: error.errors });
      return;
    }
    res.status(500).json({ message: 'Error al eliminar el Dienst', error });
    return;
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

    const dienste = await Dienst.find(query).populate('assignments.driver assignments.medic');
    res.status(200).json(dienste);
    return;
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: 'Parámetros inválidos', errors: error.errors });
      return;
    }
    res.status(500).json({ message: 'Error al buscar Diensts', error });
    return;
  }
};

export const getDienstsByUser = async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const diensts = await Dienst.find({
      'assignments': {
        $elemMatch: {
          $or: [
            { driver: userId },
            { medic: userId }
          ]
        }
      }
    });

    res.status(200).json(diensts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching diensts', error });
  }
};



