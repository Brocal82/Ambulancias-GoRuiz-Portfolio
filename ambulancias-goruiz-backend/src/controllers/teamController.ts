// src/controllers/teamController.ts
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Team from '../models/Team';
import User from '../models/User';
import VacationRequest from '../models/vacationRequest';
import { DateTime } from 'luxon';
import { isOnVacationDay } from '../utils/dienstValidation';

const ZONE = 'Europe/Berlin';

const isObjectId = (s: unknown) =>
  typeof s === 'string' && mongoose.Types.ObjectId.isValid(s);

// 👉 Helper: devuelve si está de vacaciones HOY y hasta cuándo
async function getTodayVacationInfo(userId?: mongoose.Types.ObjectId | string | null) {
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    return { isOnVacation: false as const, vacationUntil: undefined as string | undefined };
  }

  const now = DateTime.now().setZone(ZONE);
  const startOfToday = now.startOf('day').toJSDate();
  const endOfToday = now.endOf('day').toJSDate();

  const vac = await VacationRequest
    .findOne({
      user: userId,
      status: 'accepted',
      startDate: { $lte: endOfToday },
      endDate:   { $gte: startOfToday },
    })
    .select('endDate')
    .lean();

  if (!vac) {
    return { isOnVacation: false as const, vacationUntil: undefined };
  }

  return {
    isOnVacation: true as const,
    vacationUntil: new Date(vac.endDate).toISOString(),
  };
}

export const listTeams = async (_req: Request, res: Response) => {
  try {
    const teams = await Team.find()
      .populate('driver', 'name lastName ambulanceRole pscheinExpiry')
      .populate('medic',  'name lastName ambulanceRole pscheinExpiry')
      .lean();

    // ⏰ Fecha de hoy (ISO) en zona Berlin (corrige DST/off-by-one)
    const todayISO = DateTime.now().setZone(ZONE).toISODate()!;

    // Añadimos flags de vacaciones (hoy) y 'vacationUntil' sin romper el shape existente
    await Promise.all(
      teams.map(async (t: any) => {
        if (t?.driver?._id) {
          // bandera actual (reutiliza tu util)
          t.driver.isOnVacation = await isOnVacationDay({
            userId: String(t.driver._id),
            dateISO: todayISO,
          });
          // fecha 'hasta' (solo si está de vacaciones hoy)
          if (t.driver.isOnVacation) {
            const info = await getTodayVacationInfo(t.driver._id);
            t.driver.vacationUntil = info.vacationUntil;
          }
        }
        if (t?.medic?._id) {
          t.medic.isOnVacation = await isOnVacationDay({
            userId: String(t.medic._id),
            dateISO: todayISO,
          });
          if (t.medic.isOnVacation) {
            const info = await getTodayVacationInfo(t.medic._id);
            t.medic.vacationUntil = info.vacationUntil;
          }
        }
      })
    );

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

    // 🚫 impedir que cualquiera de los dos ya pertenezca a otro team
    const [driverConflict, medicConflict] = await Promise.all([
      Team.findOne({ $or: [{ driver }, { medic: driver }] }).lean(),
      Team.findOne({ $or: [{ driver: medic }, { medic }] }).lean(),
    ]);

    if (driverConflict) {
      res.status(409).json({
        message:
          'El conductor seleccionado ya pertenece a un equipo. Elimínalo de su equipo actual antes de crear otro.',
      });
      return;
    }

    if (medicConflict) {
      res.status(409).json({
        message:
          'El sanitario seleccionado ya pertenece a un equipo. Elimínalo de su equipo actual antes de crear otro.',
      });
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
