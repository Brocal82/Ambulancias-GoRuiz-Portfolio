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
import { findWeeklyConflicts, getDriverPscheinState, isOnVacationDay } from '../utils/dienstValidation';



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
      .populate('assignments.driver', 'name lastName')
      .populate('assignments.medic', 'name lastName')
      .populate('assignments.ambulanceId');
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

export const assignTeamToWeek = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dienstNumber, weekStartDate, teamId } = req.body as {
      dienstNumber?: number;
      weekStartDate?: string; // 'YYYY-MM-DD'
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

    // Cargamos el team (lean + populate)
    const team = await Team.findById(teamId)
      .populate('driver', 'pscheinExpiry')
      .populate('medic', 'pscheinExpiry')
      .lean();

    if (!team) {
      res.status(404).json({ message: 'Team no encontrado' });
      return;
    }

    // 🔧 Normalizar a id string
    const toIdString = (v: any): string | undefined =>
      typeof v === 'string'
        ? v
        : v && typeof v === 'object' && v._id
        ? String(v._id)
        : undefined;

    const driverId = toIdString((team as any).driver);
    const medicId  = toIdString((team as any).medic);

    if (!driverId || !medicId) {
      res.status(400).json({ message: 'Team inválido: faltan driver o medic' });
      return;
    }

    // ✅ Validación P-Schein del driver
    const driverPschein = getDriverPscheinState((team as any).driver?.pscheinExpiry);
    if (driverPschein === 'expired') {
      res.status(409).json({
        code: 'pschein_expired',
        message: 'El P-Schein del conductor está caducado. No se puede asignar el equipo.',
      });
      return;
    }

    // Semana / Dienst
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

    // ✅ Conflictos semanales (en otros Dienst de la misma semana)
    const [driverConf, medicConf] = await Promise.all([
      findWeeklyConflicts(new mongoose.Types.ObjectId(driverId), start, dienstNumber),
      findWeeklyConflicts(new mongoose.Types.ObjectId(medicId),  start, dienstNumber),
    ]);

    if (driverConf.length || medicConf.length) {
      res.status(409).json({
        code: 'weekly_conflict',
        message: 'Alguno de los miembros ya está asignado a otro Dienst esta semana.',
        details: { driverConf, medicConf },
      });
      return;
    }

    // Días válidos del Dienst
    const dates = Array.from(
      new Set(
        (dienst.assignments || [])
          .filter(a => a?.date && a?.startTime && a?.endTime)
          .map(a => a.date)
      )
    );

    // ✅ Vacaciones por día (accepted)
    const vacationMap: Record<string, { driver: boolean; medic: boolean }> = {};
    await Promise.all(
      dates.map(async (dateISO) => {
        const [drvVac, medVac] = await Promise.all([
          isOnVacationDay({ userId: driverId, dateISO }),
          isOnVacationDay({ userId: medicId,  dateISO }),
        ]);
        vacationMap[dateISO] = { driver: drvVac, medic: medVac };
      })
    );

    // Aplicar asignación solo en días sin vacaciones
    let updatedCount = 0;
    const skippedByVacation: string[] = [];

    dienst.assignments = dienst.assignments.map((a) => {
      if (!a?.date || !a?.startTime || !a?.endTime) return a;

      const vac = vacationMap[a.date] || { driver: false, medic: false };
      if (vac.driver || vac.medic) {
        skippedByVacation.push(a.date);
        return a; // saltar ese día
      }

      updatedCount += 1;
      return {
        ...a,
        driver: new mongoose.Types.ObjectId(driverId),
        medic: new mongoose.Types.ObjectId(medicId),
      };
    });

    await dienst.save();

    res.status(200).json({
      message: `Team asignado a ${updatedCount} días del Dienst #${dienstNumber} (${weekStartDate}).`,
      updatedCount,
      skippedByVacation,
      dienstId: dienst.id,
      weekStartDate,
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

    // Si es driver, validar P-Schein
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

    // Conflictos semanales (cualquier Dienst de esa misma semana)
    const weeklyConf = await findWeeklyConflicts(new mongoose.Types.ObjectId(userId), start, dienstNumber);
    if (weeklyConf.length > 0) {
      res.status(409).json({
        code: 'weekly_conflict',
        message: 'Este usuario ya está asignado a otro Dienst esta semana.',
        details: weeklyConf,
      });
      return;
    }

    // Buscar el Dienst de esa semana y número (mismo día en la columna weekStartDate)
    const nextDay = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const dienst = await Dienst.findOne({
      dienstNumber,
      weekStartDate: { $gte: start, $lt: nextDay },
    });

    if (!dienst) {
      res.status(404).json({ message: 'No existe Dienst para esa semana y número' });
      return;
    }

    // Días válidos (tienen date/start/end) y filtrar vacaciones
    const dates = Array.from(
      new Set(
        (dienst.assignments || [])
          .filter(a => a?.date && a?.startTime && a?.endTime)
          .map(a => a.date)
      )
    );

    const vacationMap: Record<string, boolean> = {};
    await Promise.all(
      dates.map(async (dateISO) => {
        const v = await isOnVacationDay({ userId, dateISO });
        vacationMap[dateISO] = v;
      })
    );

    let updatedCount = 0;
    const skippedByVacation: string[] = [];

    dienst.assignments = dienst.assignments.map((a) => {
      if (!a?.date || !a?.startTime || !a?.endTime) return a;

      if (vacationMap[a.date]) {
        skippedByVacation.push(a.date);
        return a; // saltar días con vacaciones aceptadas
      }

      updatedCount += 1;
      return {
        ...a,
        [role]: new mongoose.Types.ObjectId(userId),
      } as any;
    });

    // Si no pudimos asignar ningún día, devolvemos un 409 específico
    if (updatedCount === 0) {
      res.status(409).json({
        code: 'no_assignable_days',
        message: 'No se pudo asignar ningún día (vacaciones u otros filtros).',
        skippedByVacation,
      });
      return;
    }

    await dienst.save();

    res.status(200).json({
      message: `Usuario asignado como ${role} a ${updatedCount} días del Dienst #${dienstNumber} (${weekStartDate}).`,
      updatedCount,
      skippedByVacation,
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



