import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { z, ZodError } from 'zod';
import { DateTime } from 'luxon';
import SickLeave from '../models/SickLeave';
import Dienst from '../models/Dienst';


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

// ────────────────────────────────────────────────────────────────────────────
// Aceptar una solicitud de baja:
//  - Marca status=accepted
//  - Calcula requiresDocument/documentDueAt/verificationStatus
//  - Desasigna al usuario de driver/medic en los Diensts del rango
// ────────────────────────────────────────────────────────────────────────────
export async function acceptSickLeave(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'ID inválido' });
      return;
    }

    // 1) Traer la baja
    const sick = await SickLeave.findById(id);
    if (!sick) {
      res.status(404).json({ message: 'Baja no encontrada' });
      return;
    }
    if (sick.status === 'accepted') {
      res.status(409).json({ message: 'La baja ya está aceptada' });
      return;
    }

    // 2) Calcular reglas del documento (≥ 3 días naturales, inclusivo, en TZ Berlin)
    const startDt = DateTime.fromJSDate(sick.startDate, { zone: ZONE }).startOf('day');
    const endDt   = DateTime.fromJSDate(sick.endDate,   { zone: ZONE }).endOf('day');

    if (endDt < startDt) {
      res.status(400).json({ message: 'El rango de fechas de la baja es inválido' });
      return;
    }

    const durationDays = Math.floor(endDt.diff(startDt, 'days').days) + 1; // inclusivo
    const requiresDocument = durationDays >= 3;

    // Deadline: 3 días desde la creación de la solicitud (inclusive) en TZ Berlin
    let verificationStatus: 'not_required' | 'pending' | 'received' | 'overdue' = 'not_required';
    let documentDueAt: Date | undefined = undefined;

    if (requiresDocument) {
      verificationStatus = 'pending';
      const created = DateTime.fromJSDate(sick.createdAt, { zone: ZONE });
      documentDueAt = created.plus({ days: 3 }).endOf('day').toJSDate();
    }

    // 3) Marcar aceptada + set de campos de documento
    sick.status = 'accepted';
    sick.requiresDocument = requiresDocument;
    sick.verificationStatus = verificationStatus;
    sick.documentDueAt = documentDueAt;
    await sick.save();

    // 4) Desasignación parcial: quitar SOLO a ese usuario de driver/medic en el rango
    //    - No tocamos horas, ambulancia ni al compañero.
    const userIdStr = String(sick.user);
    const daysISO: string[] = [];
    for (let d = startDt; d <= endDt; d = d.plus({ days: 1 })) {
      daysISO.push(d.toISODate()!); // 'YYYY-MM-DD'
    }

    // Buscar todos los Diensts que tengan assignments en cualquiera de esos días
    const dienste = await Dienst.find({
      'assignments.date': { $in: daysISO },
    });

    let diensteTouched = 0;
    let assignmentsTouched = 0;

    for (const d of dienste) {
      let changedDienst = false;

      d.assignments = (d.assignments || []).map((a: any) => {
        if (!a?.date || !a?.startTime || !a?.endTime) return a;
        if (!daysISO.includes(a.date)) return a;

        const drv = a?.driver ? String(a.driver) : undefined;
        const med = a?.medic ? String(a.medic) : undefined;

        let changed = false;
        const next: any = { ...a };

        if (drv && drv === userIdStr) {
          next.driver = undefined;
          changed = true;
        }
        if (med && med === userIdStr) {
          next.medic = undefined;
          changed = true;
        }

        if (changed) {
          assignmentsTouched += 1;
          changedDienst = true;
        }
        return next;
      });

      if (changedDienst) {
        await d.save();
        diensteTouched += 1;
      }
    }

    res.status(200).json({
      message: 'Baja aceptada y desasignación aplicada',
      sickLeaveId: sick._id,
      requiresDocument,
      verificationStatus,
      documentDueAt,
      stats: {
        diensteTouched,
        assignmentsTouched,
        range: {
          startISO: startDt.toISODate(),
          endISO: endDt.toISODate(),
        },
      },
    });
  } catch (err) {
    console.error('❌ acceptSickLeave error:', err);
    res.status(500).json({ message: 'Error al aceptar la baja' });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Rechazar una solicitud de baja (no desasigna nada)
// ────────────────────────────────────────────────────────────────────────────
export async function rejectSickLeave(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'ID inválido' });
      return;
    }

    const sick = await SickLeave.findById(id);
    if (!sick) {
      res.status(404).json({ message: 'Baja no encontrada' });
      return;
    }

    if (sick.status === 'rejected') {
      res.status(409).json({ message: 'La baja ya está rechazada' });
      return;
    }

    // Si ya estaba aceptada, por ahora no revertimos desasignaciones
    sick.status = 'rejected';
    await sick.save();

    res.status(200).json({
      message: 'Baja rechazada',
      sickLeaveId: sick._id,
      status: sick.status,
    });
  } catch (err) {
    console.error('❌ rejectSickLeave error:', err);
    res.status(500).json({ message: 'Error al rechazar la baja' });
  }
}

// ────────────────────────────────────────────────────────────────────────────
/**
 * Adjuntar/actualizar Krankschreibung para una baja
 * - Lo usa el trabajador autenticado
 * - Recibe { documentUrl: string }
 * - Marca verificationStatus = 'received' (si antes era 'pending')
 */
// ────────────────────────────────────────────────────────────────────────────
export async function attachSickDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'ID inválido' });
      return;
    }

    const { documentUrl } = (req.body || {}) as { documentUrl?: string };
    if (!documentUrl || typeof documentUrl !== 'string') {
      res.status(400).json({ message: 'documentUrl es requerido' });
      return;
    }

    const authId = (req as any)?.user?.id || (req as any)?.userId;
    const sick = await SickLeave.findById(id);
    if (!sick) {
      res.status(404).json({ message: 'Baja no encontrada' });
      return;
    }

    // Seguridad mínima: si no es admin, debe ser el dueño de la baja
    const isAdmin = (req as any)?.user?.role === 'admin' || (req as any)?.role === 'admin';
    if (!isAdmin && authId && String(sick.user) !== String(authId)) {
      res.status(403).json({ message: 'No autorizado para adjuntar documento a esta baja' });
      return;
    }

    sick.documentUrl = documentUrl;

    // Si requería documento y estaba pendiente, lo marcamos recibido
    if (sick.requiresDocument && sick.verificationStatus === 'pending') {
      sick.verificationStatus = 'received';
      // Si en el futuro añadimos 'verified', aquí no lo tocamos.
    }

    await sick.save();

    res.status(200).json({
      message: 'Documento adjuntado correctamente',
      sickLeaveId: sick._id,
      verificationStatus: sick.verificationStatus,
      documentUrl: sick.documentUrl,
    });
  } catch (err) {
    console.error('❌ attachSickDocument error:', err);
    res.status(500).json({ message: 'Error al adjuntar el documento' });
  }
}


