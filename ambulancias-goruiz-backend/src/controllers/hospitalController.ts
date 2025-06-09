import { Request, Response } from 'express';
import { Hospital } from '../models/Hospital';
import { normalizeText } from '../utils/textUtils';

export const getAllHospitals = async (_req: Request, res: Response) => {
  try {
    const hospitals = await Hospital.find();
    res.status(200).json(hospitals);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los hospitales' });
  }
};

export const createHospital = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, address, phone, specialties, isOpen } = req.body;

    if (!name || !address || !phone || !specialties || !Array.isArray(specialties)) {
      res.status(400).json({ message: 'Faltan campos obligatorios o tipo inválido' });
      return;
    }

    const cleanedSpecialties = specialties.map((spec: string) => spec.trim());

    const hospital = new Hospital({
      name,
      address,
      phone,
      specialties: cleanedSpecialties,
      isOpen,
    });

    const saved = await hospital.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error('Error al crear hospital:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};


export const updateHospital = async (req: Request, res: Response) => {
  try {
    const updatedFields = { ...req.body };

    // Limpiar espacios en blanco de especialidades sin quitar tildes ni cambiar formato
    if (updatedFields.specialties && Array.isArray(updatedFields.specialties)) {
      updatedFields.specialties = updatedFields.specialties.map((spec: string) => spec.trim());
    }

    const updated = await Hospital.findByIdAndUpdate(req.params.id, updatedFields, { new: true });

    if (!updated) {
      res.status(404).json({ message: 'Hospital no encontrado' });
      return;
    }

    res.status(200).json(updated);
  } catch (error) {
    console.error('❌ Error al actualizar hospital:', error);
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
