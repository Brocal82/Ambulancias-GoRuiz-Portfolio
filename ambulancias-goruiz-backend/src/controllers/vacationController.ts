//src/controllers/vacationController.ts
import { Request, Response } from 'express';
import type { IVacationRequestModel } from '../models/vacationRequest';
import VacationRequest from '../models/vacationRequest';
import { findOverCapacityDays } from '../utils/vacationCapacity';
import mongoose from 'mongoose';

// ======================================================
// Config mensual embebida (NO se crea archivo nuevo)
// ======================================================
import {
  Schema as MongooseSchema,
  model as mongooseModel,
  models as mongooseModels,
} from 'mongoose';

// ✅ Añade aquí el tipo y el type guard (justo debajo de los imports de mongoose)
type VacationStatus = 'pending' | 'accepted' | 'cancelled' | 'option_sent';
function isVacationStatus(x: unknown): x is VacationStatus {
  return x === 'pending' || x === 'accepted' || x === 'cancelled' || x === 'option_sent';
}

interface IVacationMonthConfig {
  monthKey: string; // "YYYY-MM"
  maxPerDay: number; // capacidad del mes
  blackouts: { startDate: Date; endDate: Date }[]; // rangos bloqueados por admin
}

// Evitar recompilar el modelo en hot-reload
const VacationMonthConfig =
  (mongooseModels.VacationMonthConfig as mongoose.Model<IVacationMonthConfig>) ||
  mongooseModel<IVacationMonthConfig>(
    'VacationMonthConfig',
    new MongooseSchema<IVacationMonthConfig>(
      {
        monthKey: { type: String, required: true, unique: true, index: true },
        maxPerDay: { type: Number, required: true, default: 2 },
        blackouts: [
          {
            startDate: { type: Date, required: true },
            endDate: { type: Date, required: true },
          },
        ],
      },
      { timestamps: true }
    )
  );

const DEFAULT_MAX_PER_DAY = Number(process.env.MAX_VACATIONS_PER_DAY ?? 2);

function toMonthKey(year: number, month1to12: number) {
  return `${year}-${String(month1to12).padStart(2, '0')}`;
}
function dayStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function dayEnd(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function isInRange(d: Date, start: Date, end: Date) {
  const t = d.getTime();
  return t >= dayStart(start).getTime() && t <= dayEnd(end).getTime();
}

// Lee la capacidad para el mes de una fecha dada (si no hay config, usa DEFAULT_MAX_PER_DAY)
async function getMaxPerDayForDate(date: Date): Promise<number> {
  const y = date.getFullYear();
  const m1 = date.getMonth() + 1;
  const key = toMonthKey(y, m1);
  const cfg = await VacationMonthConfig.findOne({ monthKey: key }).lean();
  return cfg?.maxPerDay ?? DEFAULT_MAX_PER_DAY;
}


// ======================================================
// Controladores existentes
// ======================================================

// Obtener todas las solicitudes (solo admin)
export const getVacationRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const requests = await VacationRequest.find().populate('user', 'name lastName email');
    res.status(200).json(requests);
  } catch (error) {
    console.error('Error al obtener solicitudes de vacaciones:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Crear nueva solicitud (trabajador)
export const createVacationRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId; // del token
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      res.status(400).json({ message: 'Las fechas de inicio y fin son obligatorias' });
      return;
    }

    const newRequest = new VacationRequest({
      user: new mongoose.Types.ObjectId(userId),
      startDate,
      endDate,
      status: 'pending',
      requestedAt: new Date(),
    });

    await newRequest.save();

    res.status(201).json(newRequest);
  } catch (error) {
    console.error('Error al crear solicitud de vacaciones:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Actualizar solicitud (admin): estado, alternativa, nota
export const updateVacationRequest = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status, adminOptionStartDate, adminOptionEndDate, adminNote } = req.body;

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // 1) Cargar la solicitud dentro de la transacción
      const request = await VacationRequest.findById(id).session(session);
      if (!request) {
        res.status(404).json({ message: 'Solicitud no encontrada' });
        // lanzamos para abortar la tx sin duplicar respuestas
        throw new Error('__ABORT__');
      }

      // 2) Validación de capacidad SOLO si se va a aceptar
      if (status === 'accepted') {
        const maxPerDay = await getMaxPerDayForDate(new Date(request.startDate));
        const overDays = await findOverCapacityDays(
          VacationRequest,
          request.startDate,
          request.endDate,
          maxPerDay,
          request._id.toString()
        );

        if (overDays.length > 0) {
          res.status(409).json({
            code: 'capacity_exceeded',
            message: 'Capacidad diaria alcanzada para uno o más días del rango.',
            days: overDays, // ISO (00:00) de los días bloqueados
          });
          // abortar transacción sin guardar cambios
          throw new Error('__ABORT__');
        }
      }

      // 3) Actualizar campos permitidos (con type guard para evitar warning de TS)
      if (typeof status !== 'undefined') {
        if (isVacationStatus(status)) {
          request.status = status;
        } else {
          res.status(400).json({ message: 'Estado inválido' });
          throw new Error('__ABORT__');
        }
      }

      if (adminOptionStartDate) request.adminOptionStartDate = new Date(adminOptionStartDate);
      if (adminOptionEndDate) request.adminOptionEndDate = new Date(adminOptionEndDate);
      if (typeof adminNote === 'string') request.adminNote = adminNote;


      // 4) Guardar dentro de la transacción
      await request.save({ session });

      // 5) Responder OK con el doc actualizado
      res.status(200).json(request);
    });
  } catch (err: any) {
    if (err?.message === '__ABORT__') {
      // ya respondimos dentro de la tx (404 o 409)
      return;
    }
    console.error('❌ Error al actualizar solicitud de vacaciones:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  } finally {
    session.endSession();
  }
};


// Responder a fecha alternativa (trabajador)
export const respondToAlternativeDate = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { accept } = req.body; // boolean

    const request = await VacationRequest.findById(id) as IVacationRequestModel | null;
    if (!request) {
      res.status(404).json({ message: 'Solicitud no encontrada' });
      return;
    }

    if (request.user.toString() !== userId) {
      res.status(403).json({ message: 'No autorizado para responder a esta solicitud' });
      return;
    }

    if (accept) {
      // Usuario acepta la alternativa: actualizar fechas y estado
      if (request.adminOptionStartDate) request.startDate = request.adminOptionStartDate;
      if (request.adminOptionEndDate) request.endDate = request.adminOptionEndDate;
      request.status = 'accepted';
      request.adminOptionStartDate = undefined;
      request.adminOptionEndDate = undefined;
      request.adminNote = undefined;
    } else {
      // Usuario rechaza la alternativa: reiniciar solicitud (cancelar)
      request.status = 'cancelled';
      request.adminOptionStartDate = undefined;
      request.adminOptionEndDate = undefined;
      request.adminNote = undefined;
    }

    await request.save();

    res.status(200).json(request);
  } catch (error) {
    console.error('Error al responder a fecha alternativa:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getUserVacationRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId; // obtener id desde el token (middleware authenticateToken)
    const requests = await VacationRequest.find({ user: userId }).populate('user', 'name lastName email');
    res.status(200).json(requests);
  } catch (error) {
    console.error('Error al obtener solicitudes del usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const deleteVacationRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const request = await VacationRequest.findById(id);

    if (!request) {
      res.status(404).json({ message: 'Solicitud no encontrada' });
      return;
    }

    await request.deleteOne();

    res.status(200).json({ message: 'Solicitud eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar solicitud de vacaciones:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * GET /vacations/count?status=pending
 * Devuelve { count: number }
 * - status por query (opcional), por defecto 'pending'
 * - se usa conteo derivado del propio módulo (sin duplicar notificaciones)
 */
export const getVacationPendingCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawStatus = typeof req.query.status === 'string' ? req.query.status : 'pending';
    const status = rawStatus.toLowerCase();

    const count = await VacationRequest.countDocuments({ status });
    res.status(200).json({ count });
  } catch (error) {
    console.error('Error al contar solicitudes de vacaciones:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// ======================================================
// NUEVO: Chequear vacaciones en un rango por usuario
// POST /vacations/check-range
// Payload: { userIds: string[], fromISO: 'YYYY-MM-DD', toISO: 'YYYY-MM-DD' }
// Respuesta: Record<userId, {
//   hasVacationInRange: boolean;
//   vacationStartInRange?: string; // 'YYYY-MM-DD' (acotado al rango solicitado)
//   vacationUntilInRange?: string; // 'YYYY-MM-DD' (acotado al rango solicitado)
// }}
// ======================================================
export const checkVacationsInRange = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userIds, fromISO, toISO } = req.body as {
      userIds?: string[];
      fromISO?: string;
      toISO?: string;
    };

    if (!Array.isArray(userIds) || userIds.length === 0 || !fromISO || !toISO) {
      res.status(400).json({ message: 'Parámetros inválidos. Se requieren userIds[], fromISO y toISO.' });
      return;
    }

    // Normalizamos el rango [00:00..23:59] en UTC (suficiente para la señal visual)
    const from = new Date(`${fromISO}T00:00:00.000Z`);
    const to = new Date(`${toISO}T23:59:59.999Z`);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
      res.status(400).json({ message: 'Rango de fechas inválido.' });
      return;
    }

    const userObjectIds = userIds.map((id) => new mongoose.Types.ObjectId(id));

    // Solo solicitudes ACCEPTED que SOLAPEN el rango
    const requests = await VacationRequest.find({
      status: 'accepted',
      user: { $in: userObjectIds },
      startDate: { $lte: to },
      endDate: { $gte: from },
    })
      .select('user startDate endDate')
      .lean();

    // Inicializamos el resultado para todos los userIds
    const result: Record<
      string,
      {
        hasVacationInRange: boolean;
        vacationStartInRange?: string;
        vacationUntilInRange?: string;
      }
    > = {};
    for (const id of userIds) {
      result[id] = { hasVacationInRange: false };
    }

    // Reducimos por usuario: tomamos el tramo solapado [max(start, from) .. min(end, to)]
    // Si hay múltiples solicitudes, unimos usando el inicio más temprano y el fin más tardío dentro del rango pedido.
    for (const r of requests) {
      const uid = String(r.user);
      const overlapStart = new Date(Math.max(new Date(r.startDate).getTime(), from.getTime()));
      const overlapEnd = new Date(Math.min(new Date(r.endDate).getTime(), to.getTime()));
      if (overlapStart > overlapEnd) continue;

      const prev = result[uid];
      if (!prev || !prev.hasVacationInRange) {
        result[uid] = {
          hasVacationInRange: true,
          vacationStartInRange: overlapStart.toISOString().slice(0, 10),
          vacationUntilInRange: overlapEnd.toISOString().slice(0, 10),
        };
      } else {
        // Unimos rangos: min(start), max(end)
        const prevStart = new Date(`${prev.vacationStartInRange}T00:00:00.000Z`);
        const prevEnd = new Date(`${prev.vacationUntilInRange}T23:59:59.999Z`);
        const newStart = new Date(Math.min(prevStart.getTime(), overlapStart.getTime()));
        const newEnd = new Date(Math.max(prevEnd.getTime(), overlapEnd.getTime()));
        result[uid] = {
          hasVacationInRange: true,
          vacationStartInRange: newStart.toISOString().slice(0, 10),
          vacationUntilInRange: newEnd.toISOString().slice(0, 10),
        };
      }
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Error en checkVacationsInRange:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};


// ======================================================
// NUEVO: Disponibilidad mensual (enmascara blackouts como capacidad)
// ======================================================

// GET /vacations/availability?year=YYYY&month=MM
// Respuesta: { year, month, maxPerDay, days:[{ day, approvedCount, pendingCount, remaining, state }] }
// state: "green" | "yellow" | "red"
export const getAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month); // 1..12

    if (!year || !month || month < 1 || month > 12) {
      res.status(400).json({ message: 'Parámetros inválidos: year y month (1..12) son requeridos' });
      return;
    }

    const monthKey = toMonthKey(year, month);
    const monthStart = dayStart(new Date(year, month - 1, 1));
    const monthEnd = dayEnd(new Date(year, month, 0));
    const cfg = await VacationMonthConfig.findOne({ monthKey }).lean();

    const maxPerDay = cfg?.maxPerDay ?? DEFAULT_MAX_PER_DAY;
    const blackouts = cfg?.blackouts ?? [];

    // Trae solicitudes que solapan el mes y que afectan a la disponibilidad visual
    const requests = await VacationRequest.find({
      status: { $in: ['pending', 'accepted'] }, // 'option_sent' la puedes añadir si la consideras "pendiente"
      startDate: { $lte: monthEnd },
      endDate: { $gte: monthStart },
    })
      .select('startDate endDate status user')
      .lean();

    const daysInMonth = new Date(year, month, 0).getDate();
    const days: {
      day: number;
      approvedCount: number;
      pendingCount: number;
      remaining: number; // restante en base a ACEPTADAS (nuevo significado)
      state: 'green' | 'yellow' | 'red';
    }[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const current = new Date(year, month - 1, d);

      // Blackout → enmascarar como capacidad llena
      const isBlackout = blackouts.some((r) => isInRange(current, r.startDate, r.endDate));
      if (isBlackout) {
        days.push({
          day: d,
          approvedCount: maxPerDay,
          pendingCount: 0,
          remaining: 0,
          state: 'red',
        });
        continue;
      }

      // Conteos por día
      let approvedCount = 0;
      let pendingCount = 0;

      for (const r of requests) {
        if (isInRange(current, r.startDate as Date, r.endDate as Date)) {
          if (r.status === 'accepted') approvedCount += 1;
          else if (r.status === 'pending') pendingCount += 1;
        }
      }

      // 🔴 NUEVO: remaining basado SOLO en aceptadas
      const remaining = Math.max(0, maxPerDay - approvedCount);

      // 🔴 NUEVAS reglas de color
      const state: 'green' | 'yellow' | 'red' =
        approvedCount >= maxPerDay ? 'red' :
          pendingCount > 0 ? 'yellow' :
            'green';

      days.push({ day: d, approvedCount, pendingCount, remaining, state });
    }

    res.status(200).json({ year, month, maxPerDay, days });
  } catch (error) {
    console.error('Error al calcular disponibilidad:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};


// ======================================================
// NUEVO: Config mensual (admin)
// ======================================================

// GET /vacations/month-config?monthKey=YYYY-MM
export const getMonthConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const monthKey = String(req.query.monthKey || '');
    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
      res.status(400).json({ message: 'monthKey inválido. Formato "YYYY-MM".' });
      return;
    }
    const cfg = await VacationMonthConfig.findOne({ monthKey }).lean();
    res.status(200).json(
      cfg ?? {
        monthKey,
        maxPerDay: DEFAULT_MAX_PER_DAY,
        blackouts: [],
      }
    );
  } catch (error) {
    console.error('Error al obtener config mensual:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// POST /vacations/month-config  { monthKey, maxPerDay, blackouts:[{startDate,endDate}] }
export const upsertMonthConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { monthKey, maxPerDay, blackouts } = req.body as {
      monthKey: string;
      maxPerDay?: number;
      blackouts?: { startDate: string | Date; endDate: string | Date }[];
    };

    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
      res.status(400).json({ message: 'monthKey inválido. Formato "YYYY-MM".' });
      return;
    }

    const payload: Partial<IVacationMonthConfig> = { monthKey };
    if (typeof maxPerDay === 'number' && maxPerDay >= 0) payload.maxPerDay = maxPerDay;
    if (Array.isArray(blackouts)) {
      payload.blackouts = blackouts.map((r) => ({
        startDate: new Date(r.startDate),
        endDate: new Date(r.endDate),
      }));
    }

    const updated = await VacationMonthConfig.findOneAndUpdate(
      { monthKey },
      payload,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json(updated);
  } catch (error) {
    console.error('Error al guardar config mensual:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};
