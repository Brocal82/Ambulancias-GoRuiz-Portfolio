import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { z, ZodError } from 'zod';
import { DateTime } from 'luxon';
import SickLeave from '../models/SickLeave';

const ZONE = 'Europe/Berlin';

// Util para convertir 'YYYY-MM-DD' → Date (inicio/fin del día en TZ Berlin)
function toBerlinDay(dateISO: string, endOfDay = false): Date {
  const dt = DateTime.fromISO(dateISO, { zone: ZONE });
  return (endOfDay ? dt.endOf('day') : dt.startOf('day')).toJSDate();
}

// ⚠️ Ajusta si tu middleware de auth usa otro campo (req.user.id, req.userId, etc.)
function getAuthUserId(req: Request): string | undefined {
  return (req as any)?.user?.id || (req as any)?.userId;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Validaciones                                                               */
/* ────────────────────────────────────────────────────────────────────────── */
const createSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // 'YYYY-MM-DD'
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(1000).optional(),
  documentUrl: z.string().url().optional(), // opcional; suele subirse después
});

/* ────────────────────────────────────────────────────────────────────────── */
/* Controladores                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

// Trabajador crea solicitud de baja (queda en 'pending')
export async function createSickLeave(req: Request, res: Response) {
  try {
    const parsed = createSchema.parse(req.body);

    const userId = getAuthUserId(req) || (req.body.user as string | undefined); // fallback por si admin crea a nombre de otro
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ message: 'Usuario no válido' });
      return;
    }

    const start = toBerlinDay(parsed.startDate, false);
    const end   = toBerlinDay(parsed.endDate, true);

    if (end < start) {
      res.status(400).json({ message: 'El rango de fechas es inválido (endDate < startDate)' });
      return;
    }

    const doc = await SickLeave.create({
      user: new mongoose.Types.ObjectId(userId),
      startDate: start,
      endDate: end,
      status: 'pending',
      note: parsed.note,
      documentUrl: parsed.documentUrl,
      // ⚠️ Dejamos los campos de documento con sus defaults.
      //    Los ajustaremos al ACEPTAR (Paso 5) según la duración (≥3 días).
    });

    res.status(201).json(doc);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ message: 'Datos inválidos', errors: err.errors });
      return;
    }
    console.error('❌ createSickLeave error:', err);
    res.status(500).json({ message: 'Error al crear la baja' });
  }
}

// Admin lista solicitudes (filtros opcionales: status, user)
export async function listSickLeaves(req: Request, res: Response) {
  try {
    const { status, user } = req.query as { status?: string; user?: string };

    const q: any = {};
    if (status && ['pending', 'accepted', 'rejected'].includes(status)) {
      q.status = status;
    }
    if (user && mongoose.Types.ObjectId.isValid(user)) {
      q.user = new mongoose.Types.ObjectId(user);
    }

    const items = await SickLeave.find(q)
      .sort({ createdAt: -1 })
      .populate('user', 'name lastName email ambulanceRole')
      .lean();

    res.status(200).json(items);
  } catch (err) {
    console.error('❌ listSickLeaves error:', err);
    res.status(500).json({ message: 'Error al listar las bajas' });
  }
}

// Trabajador ve SUS solicitudes (filtro opcional por status)
export async function listMySickLeaves(req: Request, res: Response) {
  try {
    const authId = getAuthUserId(req);
    if (!authId || !mongoose.Types.ObjectId.isValid(authId)) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    const { status } = req.query as { status?: string };
    const q: any = { user: new mongoose.Types.ObjectId(authId) };
    if (status && ['pending', 'accepted', 'rejected'].includes(status)) {
      q.status = status;
    }

    const items = await SickLeave.find(q).sort({ createdAt: -1 }).lean();
    res.status(200).json(items);
  } catch (err) {
    console.error('❌ listMySickLeaves error:', err);
    res.status(500).json({ message: 'Error al listar tus bajas' });
  }
}
