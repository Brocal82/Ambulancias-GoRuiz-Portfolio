import { Request, Response } from 'express';
import Dienst from '../models/Dienst';

export const createDienst = async (req: Request, res: Response) => {
  try {
    const newDienst = new Dienst(req.body);
    const savedDienst = await newDienst.save();
    res.status(201).json(savedDienst);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear Dienst', error });
  }
};
