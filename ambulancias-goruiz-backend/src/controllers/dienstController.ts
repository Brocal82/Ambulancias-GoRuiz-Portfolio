//src/controllers/dienstController.ts
import { Request, Response } from 'express';
import Dienst from '../models/Dienst';
import Ambulance from '../models/Ambulance'; // ✅ Nuevo import
import { dienstSchema } from '../schemas/dienstSchema';
import { dienstQuerySchema } from '../schemas/dienstQuerySchema';
import { ZodError, z } from 'zod';
import mongoose from 'mongoose';
import { RequestHandler } from 'express';
import { AssignedDay } from '../types/Dienst';
import Team from '../models/Team';
import User from '../models/User';
import { getPscheinStatus } from '../utils/pscheinUtils';
import { findWeeklyConflicts, getDriverPscheinState, isOnVacationDay, isOnSickDay } from '../utils/dienstValidation';



const idSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, {
  message: 'ID no válido',
});

export const createDienst = async (req: Request, res: Response) => {
  try {
    const parsedData = dienstSchema.parse(req.body);
    const newDienst = new Dienst(parsedData);
    const savedDienst = await newDienst.save();
    res.status(201).json(savedDienst);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
    } else {
      res.status(500).json({ message: 'Error al crear Dienst', error });
    }
  }
};

export const getAllDiensts: RequestHandler = async (req, res) => {
  try {
    const diensts = await Dienst.find()
      .populate('assignments.driver', 'name lastName pscheinExpiry ambulanceRole')
      .populate('assignments.medic', 'name lastName pscheinExpiry ambulanceRole')
      .populate('assignments.ambulanceId', 'ambulanceNumber brand modelName licensePlate')
      .lean(); // 👈 opcional pero recomendable para front
    res.status(200).json(diensts);
  } catch (error) {
    console.error("Error al obtener los Diensts:", error);
    res.status(500).json({ message: "Error al obtener los Diensts" });
  }
};


export const getDienstById = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);
    const dienst = await Dienst.findById(parsedId)
      .populate('assignments.driver assignments.medic assignments.ambulanceId');
    if (!dienst) {
      res.status(404).json({ message: 'Dienst no encontrado' });
      return;
    }
    res.status(200).json(dienst);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: 'ID inválido', errors: error.errors });
    } else {
      res.status(500).json({ message: 'Error al obtener el Dienst', error });
    }
  }
};

export const updateDienst = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);
    const parsedData = dienstSchema.partial().parse(req.body);
    const updatedDienst = await Dienst.findByIdAndUpdate(parsedId, parsedData, { new: true })
      .populate('assignments.driver assignments.medic assignments.ambulanceId');
    if (!updatedDienst) {
      res.status(404).json({ message: 'Dienst no encontrado' });
      return;
    }
    res.status(200).json(updatedDienst);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
    } else {
      res.status(500).json({ message: 'Error al actualizar el Dienst', error });
    }
  }
};

export const updateDienstPartial: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { assignments } = req.body;

  if (!assignments || !Array.isArray(assignments)) {
    res.status(400).json({ message: "No se proporcionaron assignments válidos." });
    return;
  }

  try {
    const dienst = await Dienst.findById(id);
    if (!dienst) {
      res.status(404).json({ message: "Dienst no encontrado." });
      return;
    }

    for (const updatedAssignment of assignments) {
      const index = dienst.assignments.findIndex((a) => a.date === updatedAssignment.date);
      const updatedCopy = { ...updatedAssignment };

      if (updatedCopy._id === "") delete updatedCopy._id;
      if (updatedCopy.driver === "") updatedCopy.driver = undefined;
      if (updatedCopy.medic === "") updatedCopy.medic = undefined;

      if (!updatedCopy.ambulanceId || !updatedCopy.startTime || !updatedCopy.endTime) {
        console.warn("Assignment incompleto ignorado:", updatedCopy);
        continue;
      }

      if (index !== -1) {
        dienst.assignments[index] = {
          ...dienst.assignments[index],
          ...updatedCopy,
        };
      } else {
        dienst.assignments.push(updatedCopy);
      }
    }

    await dienst.save();
    res.json(dienst);
  } catch (error) {
    console.error("Error al actualizar Dienst:", error);
    res.status(500).json({ message: "Error al actualizar Dienst" });
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
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: 'ID inválido', errors: error.errors });
    } else {
      res.status(500).json({ message: 'Error al eliminar el Dienst', error });
    }
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
            { driver: new mongoose.Types.ObjectId(userId) },
            { medic: new mongoose.Types.ObjectId(userId) }
          ]
        }
      }
    })
      .populate("assignments.driver", "name lastName")
      .populate("assignments.medic", "name lastName");

    res.status(200).json(diensts);
  } catch (error) {
    console.error('Error fetching diensts:', error);
    res.status(500).json({ message: 'Error fetching diensts', error });
  }
};



export const getAssignedDaysForUser: RequestHandler = async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    res.status(400).json({ message: 'ID de usuario no válido' });
    return;
  }

  try {
    const diensts = await Dienst.find({
      $or: [
        { 'assignments.driver': new mongoose.Types.ObjectId(userId) },
        { 'assignments.medic': new mongoose.Types.ObjectId(userId) },
      ],
    })
      .populate("assignments.driver", "name lastName pscheinExpiry")
      .populate("assignments.medic", "name lastName pscheinExpiry")
      .populate("assignments.ambulanceId", "ambulanceNumber") // puede venir null
      .lean();

    const assignedDays: AssignedDay[] = [];

    diensts.forEach((dienst) => {
      dienst.assignments.forEach((assignment: any) => {
        // saltar si este assignment no corresponde al usuario
        const isDriver = assignment?.driver?._id?.toString() === userId;
        const isMedic = assignment?.medic?._id?.toString() === userId;
        if (!isDriver && !isMedic) return;

        const ambulanceData = assignment?.ambulanceId ?? null;

        const ambulanceId =
          ambulanceData && typeof ambulanceData === "object"
            ? ambulanceData._id?.toString()
            : typeof ambulanceData === "string"
              ? ambulanceData
              : undefined;

        const ambulanceNumber =
          ambulanceData && typeof ambulanceData === "object"
            ? ambulanceData.ambulanceNumber
            : undefined;

        assignedDays.push({
          dienstId: dienst._id.toString(),
          dienstNumber: dienst.dienstNumber,
          assignmentId: assignment?._id?.toString(),
          date: assignment?.date,
          startTime: assignment?.startTime,
          endTime: assignment?.endTime,
          ambulanceId,
          ambulanceNumber,
          driver: assignment?.driver?._id
            ? {
              _id: assignment.driver._id.toString(),
              name: assignment.driver.name,
              lastName: assignment.driver.lastName,
              pscheinExpiry: assignment.driver.pscheinExpiry,
            }
            : assignment?.driver || null,
          medic: assignment?.medic?._id
            ? {
              _id: assignment.medic._id.toString(),
              name: assignment.medic.name,
              lastName: assignment.medic.lastName,
              pscheinExpiry: assignment.medic.pscheinExpiry,
            }
            : assignment?.medic || null,
        });
      });
    });

    res.status(200).json(assignedDays);
  } catch (error) {
    console.error("❌ Error al obtener días asignados:", error);
    res.status(500).json({ message: "Error al obtener días asignados" });
  }
};



export const generateDienstTemplatesForWeek: RequestHandler = async (req, res) => {
  const { weekStartDate } = req.body;

  if (!weekStartDate) {
    res.status(400).json({ message: "Fecha de inicio requerida" });
    return;
  }

  try {
    const startDate = new Date(weekStartDate);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const existing = await Dienst.find({
      weekStartDate: {
        $gte: startDate,
        $lte: endDate,
      },
    });

    if (existing.length > 0) {
      res.status(400).json({ message: "Ya existen Diensts para esa semana" });
      return;
    }

    const diensts = Array.from({ length: 2 }, (_, i) => {
      const dienstNumber = i + 1;
      const assignments: {
        date: string;
        startTime: string;
        endTime: string;
      }[] = [];

      for (let j = 0; j < 7; j++) {
        const day = new Date(startDate);
        day.setDate(day.getDate() + j);

        const isDayOff = [5, 6].includes((dienstNumber + j) % 7);
        if (isDayOff) continue;

        const startTime = dienstNumber % 2 === 0 ? "06:00" : "14:00";
        const endTime = dienstNumber % 2 === 0 ? "14:00" : "22:00";

        assignments.push({
          date: day.toISOString().split("T")[0],
          startTime,
          endTime,
        });
      }

      return {
        dienstNumber,
        weekStartDate: startDate,
        weekEndDate: endDate,
        assignments,
      };
    });

    await Dienst.insertMany(diensts);
    res.status(201).json({ message: "Diensts generados correctamente" });
  } catch (error) {
    console.error("❌ Error al generar Diensts:", error);
    res.status(500).json({ message: "Error al generar Diensts" });
  }
};


export const deleteDienstsForWeek: RequestHandler = async (req, res) => {
  const { weekStartDate } = req.body;

  if (!weekStartDate) {
    res.status(400).json({ message: "Fecha de inicio requerida" });
    return;
  }

  try {
    const start = new Date(weekStartDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const deleted = await Dienst.deleteMany({
      weekStartDate: {
        $gte: start,
        $lte: end,
      },
    });

    res.status(200).json({ message: "Diensts eliminados", count: deleted.deletedCount });
  } catch (error) {
    console.error("Error al eliminar Diensts:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const removeAssignment = async (req: Request, res: Response) => {
  const { date } = req.body;
  const parsedId = idSchema.parse(req.params.id);

  try {
    const updatedDienst = await Dienst.findByIdAndUpdate(
      parsedId,
      { $pull: { assignments: { date } } },
      { new: true }
    )
      .populate("assignments.driver", "name lastName pscheinExpiry")
      .populate("assignments.medic", "name lastName pscheinExpiry")
      .populate("assignments.ambulanceId", "ambulanceNumber brand modelName licensePlate");

    res.status(200).json(updatedDienst);
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar el assignment", error });
  }
};

// ✅ Asignar TEAM a la semana:
//    - Si hay CUALQUIER conflicto semanal (driver o medic en otro Dienst): ABORTAR (409).
//    - Vacaciones: seguir aplicando de forma parcial por día/rol.
//    - Excepción P-Schein driver caducado si driver=both y el compañero puede conducir.
export const assignTeamToWeek = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dienstNumber, weekStartDate, teamId } = req.body as {
      dienstNumber?: number;
      weekStartDate?: string;
      teamId?: string;
    };

    if (!dienstNumber || !weekStartDate || !teamId) {
      res.status(400).json({ message: 'Faltan parámetros: dienstNumber, weekStartDate, teamId' });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      res.status(400).json({ message: 'teamId inválido' });
      return;
    }

    const team = await Team.findById(teamId)
      .populate('driver', 'pscheinExpiry ambulanceRole')
      .populate('medic', 'pscheinExpiry ambulanceRole')
      .lean();

    if (!team) {
      res.status(404).json({ message: 'Team no encontrado' });
      return;
    }

    const toIdString = (v: any): string | undefined =>
      typeof v === 'string' ? v : v && typeof v === 'object' && v._id ? String(v._id) : undefined;

    const driverId = toIdString((team as any).driver);
    const medicId = toIdString((team as any).medic);
    if (!driverId || !medicId) {
      res.status(400).json({ message: 'Team inválido: faltan driver o medic' });
      return;
    }

    // P-Schein + excepción
    const driverDoc = (team as any).driver;
    const medicDoc = (team as any).medic;

    const driverRole = driverDoc?.ambulanceRole as ('driver' | 'medic' | 'both' | undefined);
    const medicRole = medicDoc?.ambulanceRole as ('driver' | 'medic' | 'both' | undefined);

    const driverPschein = getDriverPscheinState(driverDoc?.pscheinExpiry);
    const medicPschein = getDriverPscheinState(medicDoc?.pscheinExpiry);

    const medicCanDrive = (medicRole === 'driver' || medicRole === 'both')
      && (medicPschein === 'valid' || medicPschein === 'warning');
    const driverIsBoth = driverRole === 'both';

    let driverExpiredButBothHint = false;
    if (driverPschein === 'expired') {
      if (driverIsBoth && medicCanDrive) {
        driverExpiredButBothHint = true; // permitimos y sugerimos swap en el front
      } else {
        res.status(409).json({
          code: 'pschein_expired',
          message: 'El P-Schein del conductor está caducado. No se puede asignar el equipo.',
        });
        return;
      }
    }

    // Semana/Dienst
    const start = new Date(weekStartDate);
    if (isNaN(start.getTime())) {
      res.status(400).json({ message: 'weekStartDate inválida' });
      return;
    }

    const dienst = await Dienst.findOne({
      dienstNumber,
      weekStartDate: { $gte: start, $lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) },
    });
    if (!dienst) {
      res.status(404).json({ message: 'No existe Dienst para esa semana y número' });
      return;
    }

    // 🔒 CONFLICTOS SEMANALES (BLOQUEAMOS SI HAY CUALQUIERA)
    const [driverConf, medicConf] = await Promise.all([
      findWeeklyConflicts(new mongoose.Types.ObjectId(driverId), start, dienstNumber),
      findWeeklyConflicts(new mongoose.Types.ObjectId(medicId), start, dienstNumber),
    ]);

    if ((driverConf?.length ?? 0) > 0 || (medicConf?.length ?? 0) > 0) {
      res.status(409).json({
        code: 'weekly_conflict',
        message: 'Alguno de los miembros ya está asignado a otro Dienst esta semana.',
        details: { driverConf, medicConf },
      });
      return; // 🚫 no asignamos NADA
    }

    // ✅ Si NO hay conflictos, aplicamos (parcial solo por vacaciones)
    const dates = Array.from(
      new Set(
        (dienst.assignments || [])
          .filter(a => a?.date && a?.startTime && a?.endTime)
          .map(a => a.date)
      )
    );

// 🩺 Bloqueos por día: vacaciones o baja (sick)
const dayBlockMap: Record<string, { driver: boolean; medic: boolean }> = {};
await Promise.all(
  dates.map(async (dateISO) => {
    const [drvVac, medVac, drvSick, medSick] = await Promise.all([
      isOnVacationDay({ userId: driverId, dateISO }),
      isOnVacationDay({ userId: medicId, dateISO }),
      isOnSickDay({ userId: driverId, dateISO }),
      isOnSickDay({ userId: medicId, dateISO }),
    ]);

    dayBlockMap[dateISO] = {
      driver: Boolean(drvVac || drvSick),
      medic: Boolean(medVac || medSick),
    };
  })
);

let updatedCount = 0;
// mantenemos el mismo array por compatibilidad con el front
const skippedByVacation: Array<{ date: string; role: 'driver' | 'medic' }> = [];

dienst.assignments = (dienst.assignments || []).map((a) => {
  if (!a?.date || !a?.startTime || !a?.endTime) return a;

  const dateISO = a.date;
  const block = dayBlockMap[dateISO] || { driver: false, medic: false };

  let next = { ...a } as any;
  let changed = false;

  // 🚗 Asignar conductor si no está bloqueado
  if (!block.driver) {
    const newId = new mongoose.Types.ObjectId(driverId);
    if (!next.driver || String(next.driver) !== String(newId)) {
      next.driver = newId;
      changed = true;
    }
  } else {
    skippedByVacation.push({ date: dateISO, role: 'driver' });
  }

  // 🧑‍⚕️ Asignar sanitario si no está bloqueado
  if (!block.medic) {
    const newId = new mongoose.Types.ObjectId(medicId);
    if (!next.medic || String(next.medic) !== String(newId)) {
      next.medic = newId;
      changed = true;
    }
  } else {
    skippedByVacation.push({ date: dateISO, role: 'medic' });
  }

  if (changed) updatedCount += 1;
  return next;
});


    await dienst.save();

    res.status(200).json({
      message: `Team asignado a ${updatedCount} días del Dienst #${dienstNumber} (${weekStartDate}).`,
      updatedCount,
      skippedByVacation,
      dienstId: dienst.id,
      weekStartDate,
      hints: { driverExpiredButBoth: !!driverExpiredButBothHint },
    });

  } catch (error) {
    console.error('❌ Error en assignTeamToWeek:', error);
    res.status(500).json({ message: 'Error al asignar el Team a la semana' });
  }
};



// ✅ Asignar UN USUARIO (driver o medic) a TODA la semana de un Dienst
export const assignUserToWeek = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dienstNumber, weekStartDate, userId, role } = req.body as {
      dienstNumber?: number;
      weekStartDate?: string; // 'YYYY-MM-DD'
      userId?: string;
      role?: 'driver' | 'medic';
    };

    if (!dienstNumber || !weekStartDate || !userId || !role) {
      res.status(400).json({ message: 'Faltan parámetros: dienstNumber, weekStartDate, userId, role' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ message: 'userId inválido' });
      return;
    }

    if (role !== 'driver' && role !== 'medic') {
      res.status(400).json({ message: 'Rol inválido. Debe ser "driver" o "medic"' });
      return;
    }

    const start = new Date(weekStartDate);
    if (isNaN(start.getTime())) {
      res.status(400).json({ message: 'weekStartDate inválida' });
      return;
    }

    // 🚦 Si es driver, validar P-Schein
    if (role === 'driver') {
      const User = mongoose.model('User');
      const u = await User.findById(userId).select('pscheinExpiry').lean();
      if (!u) {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
      }
      const ps = getDriverPscheinState((u as any)?.pscheinExpiry);
      if (ps === 'expired') {
        res.status(409).json({
          code: 'pschein_expired',
          message: 'El P-Schein del conductor está caducado. No se puede asignar.',
        });
        return;
      }
    }

    // 🚧 Conflictos semanales (cualquier Dienst de esa misma semana)
    const weeklyConf = await findWeeklyConflicts(new mongoose.Types.ObjectId(userId), start, dienstNumber);
    if (weeklyConf.length > 0) {
      res.status(409).json({
        code: 'weekly_conflict',
        message: 'Este usuario ya está asignado a otro Dienst esta semana.',
        details: weeklyConf,
      });
      return;
    }

    // 🔍 Buscar el Dienst de esa semana y número
    const nextDay = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const dienst = await Dienst.findOne({
      dienstNumber,
      weekStartDate: { $gte: start, $lt: nextDay },
    });

    if (!dienst) {
      res.status(404).json({ message: 'No existe Dienst para esa semana y número' });
      return;
    }

    // 📅 Días válidos (tienen date/start/end)
    const dates = Array.from(
      new Set(
        (dienst.assignments || [])
          .filter(a => a?.date && a?.startTime && a?.endTime)
          .map(a => a.date)
      )
    );

    // 🗓️ Mapas separados para distinguir vacaciones vs baja
    const vacationMap: Record<string, boolean> = {};
    const sickMap: Record<string, boolean> = {};

    await Promise.all(
      dates.map(async (dateISO) => {
        const [isVac, isSick] = await Promise.all([
          isOnVacationDay({ userId, dateISO }),
          isOnSickDay({ userId, dateISO }),
        ]);
        vacationMap[dateISO] = Boolean(isVac);
        sickMap[dateISO] = Boolean(isSick);
      })
    );

    let updatedCount = 0;
    const skippedByVacation: string[] = [];
    const skippedBreakdown = { sick: 0, vacation: 0, both: 0 };

    dienst.assignments = dienst.assignments.map((a) => {
      if (!a?.date || !a?.startTime || !a?.endTime) return a;

      const isVac = !!vacationMap[a.date];
      const isSick = !!sickMap[a.date];

      if (isVac || isSick) {
        skippedByVacation.push(a.date);

        if (isVac && isSick) skippedBreakdown.both += 1;
        else if (isSick) skippedBreakdown.sick += 1;
        else if (isVac) skippedBreakdown.vacation += 1;

        return a; // saltar este día
      }

      updatedCount += 1;
      return {
        ...a,
        [role]: new mongoose.Types.ObjectId(userId),
      } as any;
    });

    // ⚠️ Si no se pudo asignar ningún día
    if (updatedCount === 0) {
      const onlySickBlocks =
        skippedBreakdown.sick > 0 &&
        skippedBreakdown.vacation === 0 &&
        skippedBreakdown.both === 0;

      res.status(409).json({
        code: onlySickBlocks ? 'no_assignable_days_sick' : 'no_assignable_days',
        message: onlySickBlocks
          ? 'No se pudo asignar ningún día por baja médica.'
          : 'No se pudo asignar ningún día (vacaciones u otros filtros).',
        skippedByVacation,
        skippedBreakdown,
      });
      return;
    }

    await dienst.save();

    res.status(200).json({
      message: `Usuario asignado como ${role} a ${updatedCount} días del Dienst #${dienstNumber} (${weekStartDate}).`,
      updatedCount,
      skippedByVacation,
      skippedBreakdown, // opcional para diagnóstico
      dienstId: dienst.id,
      weekStartDate,
      role,
      userId,
    });
  } catch (error) {
    console.error('❌ Error en assignUserToWeek:', error);
    res.status(500).json({ message: 'Error al asignar el usuario a la semana' });
  }
};


// ✅ Limpiar driver/medic de TODA la semana del Dienst (mantiene horas y ambulancia)
export const clearPeopleForWeek = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dienstNumber, weekStartDate } = req.body as {
      dienstNumber?: number;
      weekStartDate?: string; // 'YYYY-MM-DD'
    };

    if (!dienstNumber || !weekStartDate) {
      res.status(400).json({ message: 'Faltan parámetros: dienstNumber, weekStartDate' });
      return;
    }

    const start = new Date(weekStartDate);
    if (isNaN(start.getTime())) {
      res.status(400).json({ message: 'weekStartDate inválida' });
      return;
    }

    // Buscar Dienst por número y día exacto de inicio de semana
    const dienst = await Dienst.findOne({
      dienstNumber,
      weekStartDate: { $gte: start, $lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) },
    });

    if (!dienst) {
      res.status(404).json({ message: 'No existe Dienst para esa semana y número' });
      return;
    }

    let clearedCount = 0;

    dienst.assignments = dienst.assignments.map((a) => {
      if (!a?.date || !a?.startTime || !a?.endTime) return a;
      const hadSomeone = !!a.driver || !!a.medic;
      if (hadSomeone) clearedCount += 1;

      return {
        ...a,
        driver: undefined,
        medic: undefined,
      } as any;
    });

    await dienst.save();

    res.status(200).json({
      message: `Asignaciones (driver/medic) limpiadas para Dienst #${dienstNumber} (${weekStartDate}).`,
      clearedCount,
      dienstId: dienst.id,
      weekStartDate,
    });
  } catch (error) {
    console.error('❌ Error en clearPeopleForWeek:', error);
    res.status(500).json({ message: 'Error al limpiar asignaciones de la semana' });
  }
};

export const swapWeekRoles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dienstNumber, weekStartDate } = req.body as {
      dienstNumber?: number;
      weekStartDate?: string; // YYYY-MM-DD
    };

    if (!dienstNumber || !weekStartDate) {
      res.status(400).json({ message: 'Faltan parámetros: dienstNumber, weekStartDate' });
      return;
    }

    const start = new Date(weekStartDate);
    if (isNaN(start.getTime())) {
      res.status(400).json({ message: 'weekStartDate inválida' });
      return;
    }

    const dienst = await Dienst.findOne({
      dienstNumber,
      weekStartDate: { $gte: start, $lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) },
    });

    if (!dienst) {
      res.status(404).json({ message: 'No existe Dienst para esa semana y número' });
      return;
    }

    // Reunimos los userIds presentes en cualquier día
    const userIds = new Set<string>();
    for (const a of dienst.assignments ?? []) {
      const drv = a?.driver?.toString?.();
      const med = a?.medic?.toString?.();
      if (drv) userIds.add(drv);
      if (med) userIds.add(med);
    }

    // Traemos roles y pschein de esos usuarios
    const users = await User.find(
      { _id: { $in: Array.from(userIds).map(id => new mongoose.Types.ObjectId(id)) } },
      { ambulanceRole: 1, pscheinExpiry: 1 }
    ).lean();

    const userMap = new Map<string, { ambulanceRole?: 'driver' | 'medic' | 'both'; pscheinExpiry?: string }>();
    for (const u of users) {
      userMap.set(String(u._id), {
        ambulanceRole: u.ambulanceRole as any,
        pscheinExpiry: u.pscheinExpiry,
      });
    }

    // Helper: ¿puede user desempeñar 'driver' o 'medic'?
    const canPerformRole = (userId: string, role: 'driver' | 'medic'): { ok: boolean; reason?: string } => {
      const u = userMap.get(userId);
      if (!u) return { ok: false, reason: 'usuario_no_encontrado' };

      const r = u.ambulanceRole;
      if (role === 'driver') {
        // debe poder conducir por rol
        if (!(r === 'driver' || r === 'both')) {
          return { ok: false, reason: 'rol_no_permite_driver' };
        }
        // y P-Schein no caducado
        const ps = getPscheinStatus(u.pscheinExpiry);
        if (ps === 'expired') {
          return { ok: false, reason: 'pschein_expired' };
        }
        return { ok: true };
      } else {
        // medic
        if (!(r === 'medic' || r === 'both')) {
          return { ok: false, reason: 'rol_no_permite_medic' };
        }
        return { ok: true };
      }
    };

    // Validación previa global: si algún día no es swappeable, bloqueamos todo
    const blocked: Array<{ date: string; reason: string; driverId?: string; medicId?: string }> = [];

    for (const a of dienst.assignments ?? []) {
      if (!a?.date) continue;

      const driverId = a?.driver?.toString?.();
      const medicId = a?.medic?.toString?.();

      // Sólo nos importa validar días con ambos roles asignados
      if (!driverId || !medicId) continue;

      // El medic pasará a ser driver, y el driver pasará a ser medic
      const medicToDriver = canPerformRole(medicId, 'driver');
      const driverToMedic = canPerformRole(driverId, 'medic');

      if (!medicToDriver.ok || !driverToMedic.ok) {
        const reason =
          (!medicToDriver.ok && medicToDriver.reason === 'pschein_expired')
            ? 'medic_no_puede_ser_driver_pschein_expired'
            : (!medicToDriver.ok && medicToDriver.reason === 'rol_no_permite_driver')
              ? 'medic_no_puede_ser_driver_rol'
              : (!driverToMedic.ok && driverToMedic.reason === 'rol_no_permite_medic')
                ? 'driver_no_puede_ser_medic_rol'
                : 'condiciones_no_cumplidas';
        blocked.push({ date: a.date, reason, driverId, medicId });
      }
    }

    if (blocked.length > 0) {
      res.status(409).json({
        code: 'swap_not_permitted',
        message: 'No se puede intercambiar roles: hay días que no cumplen las condiciones.',
        details: blocked,
      });
      return;
    }

    // Aplicamos swap sólo en días con ambos roles
    let swapped = 0;
    dienst.assignments = (dienst.assignments || []).map((a) => {
      if (!a?.date || !a?.startTime || !a?.endTime) return a;

      const driverId = a?.driver?.toString?.();
      const medicId = a?.medic?.toString?.();

      if (!driverId || !medicId) return a;

      // Intercambiar driver y medic
      const newDriver = new mongoose.Types.ObjectId(medicId);
      const newMedic = new mongoose.Types.ObjectId(driverId);

      swapped += 1;
      return { ...a, driver: newDriver as any, medic: newMedic as any };
    });

    await dienst.save();

    res.status(200).json({
      message: `Roles intercambiados en ${swapped} días del Dienst #${dienstNumber} (${weekStartDate}).`,
      swappedCount: swapped,
      dienstId: dienst.id,
      weekStartDate,
    });
  } catch (err) {
    console.error('❌ Error en swapWeekRoles:', err);
    res.status(500).json({ message: 'Error al intercambiar roles de la semana' });
  }
};




