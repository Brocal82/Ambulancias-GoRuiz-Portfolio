import { Request, Response } from 'express';
import { Hospital } from '../models/Hospital';

export const getAllHospitals = async (_req: Request, res: Response) => {
  try {
    const hospitals = await Hospital.find();
    res.status(200).json(hospitals);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los hospitales' });
  }
};

export const createHospital = async (req: Request, res: Response) => {
  try {
    const newHospital = new Hospital(req.body);
    await newHospital.save();
    res.status(201).json(newHospital);
  } catch (error) {
    res.status(400).json({ message: 'Error al crear el hospital' });
  }
};

export const updateHospital = async (req: Request, res: Response) => {
  try {
    const updated = await Hospital.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(updated);
  } catch (error) {
    res.status(400).json({ message: 'Error al actualizar el hospital' });
  }
};

export const deleteHospital = async (req: Request, res: Response) => {
  try {
    await Hospital.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Hospital eliminado' });
  } catch (error) {
    res.status(400).json({ message: 'Error al eliminar el hospital' });
  }
};
