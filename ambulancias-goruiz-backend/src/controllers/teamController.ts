//src/controllers/teamController.ts
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Team from '../models/Team';
import User from '../models/User';

const isObjectId = (s: unknown) =>
  typeof s === 'string' && mongoose.Types.ObjectId.isValid(s);

export const listTeams = async (_req: Request, res: Response) => {
  try {
    const teams = await Team.find()
      .populate('driver', 'name lastName ambulanceRole pscheinExpiry')
      .populate('medic',  'name lastName ambulanceRole pscheinExpiry')
      .lean();
    res.status(200).json(teams);
  } catch (err) {
    console.error('❌ Error listTeams:', err);
    res.status(500).json({ message: 'Error al listar teams' });
  }
};

export const createTeam = async (req: Request, res: Response) => {
  try {
    const { driver, medic } = req.body as { driver?: string; medic?: string };

    if (!isObjectId(driver) || !isObjectId(medic)) {
      res.status(400).json({ message: 'driver y medic deben ser ObjectId válidos' });
      return;
    }
    if (driver === medic) {
      res.status(400).json({ message: 'driver y medic no pueden ser la misma persona' });
      return;
    }

    // (opcional) verificar que existen y su rol
    const [driverUser, medicUser] = await Promise.all([
      User.findById(driver).lean(),
      User.findById(medic).lean(),
    ]);
    if (!driverUser || !medicUser) {
      res.status(400).json({ message: 'Usuario driver o medic inexistente' });
      return;
    }

    // evitar duplicado exacto (además del índice único)
    const exists = await Team.findOne({ driver, medic }).lean();
    if (exists) {
      res.status(409).json({ message: 'Ya existe un team con esa pareja' });
      return;
    }

    const team = await Team.create({ driver, medic });
    const populated = await Team.findById(team._id)
      .populate('driver', 'name lastName ambulanceRole pscheinExpiry')
      .populate('medic',  'name lastName ambulanceRole pscheinExpiry');
    res.status(201).json(populated);
  } catch (err: any) {
    console.error('❌ Error createTeam:', err);
    if (err?.code === 11000) {
      res.status(409).json({ message: 'Team duplicado (driver+medic ya existe)' });
      return;
    }
    res.status(500).json({ message: 'Error al crear team' });
  }
};

export const deleteTeam = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      res.status(400).json({ message: 'ID inválido' });
      return;
    }
    const deleted = await Team.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404).json({ message: 'Team no encontrado' });
      return;
    }
    res.status(200).json({ message: 'Team eliminado' });
  } catch (err) {
    console.error('❌ Error deleteTeam:', err);
    res.status(500).json({ message: 'Error al eliminar team' });
  }
};
