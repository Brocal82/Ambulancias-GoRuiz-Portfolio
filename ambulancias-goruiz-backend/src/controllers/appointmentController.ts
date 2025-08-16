// backend/src/controllers/appointmentController.ts
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Appointment } from '../models/Appointment';
import { IAppointment, TimeSlot } from '../types/Appointment';

// Helpers
const parseISOToDate = (iso: string): Date => new Date(iso);
const isFuture = (d: Date) => d.getTime() > Date.now();
const sortByStartAsc = (a: TimeSlot, b: TimeSlot) => a.start.getTime() - b.start.getTime();
const timeslotEquals = (a: TimeSlot, b: TimeSlot) =>
  a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();

const validateSlots = (slots: TimeSlot[]) => {
  if (!Array.isArray(slots) || slots.length === 0) {
    throw new Error('Debes proporcionar al menos 1 opción de horario.');
  }
  if (slots.length > 3) {
    throw new Error('proposedSlots no puede tener más de 3 opciones.');
  }
  for (const s of slots) {
    if (!(s.start instanceof Date) || !(s.end instanceof Date) || Number.isNaN(s.start.getTime()) || Number.isNaN(s.end.getTime())) {
      throw new Error('Cada slot debe tener start y end ISO válidos.');
    }
    if (s.start >= s.end) throw new Error('start debe ser anterior a end.');
    if (!isFuture(s.start)) throw new Error('No se pueden proponer horarios en el pasado.');
  }
};

export const requestAppointment = async (req: Request, res: Response): Promise<void> => {
  try {
    const workerId = (req as any).userId as string;
    const { reason, details } = req.body as { reason?: string; details?: string };

    if (!reason || !details) {
      res.status(400).json({ message: 'reason y details son obligatorios.' });
      return;
    }

    const appointment: Partial<IAppointment> = {
      workerId: new mongoose.Types.ObjectId(workerId),
      reason: reason.trim(),
      details: details.trim(),
      status: 'pending',
      proposedSlots: [],
      selectedSlot: null,
    };

    const created = await Appointment.create(appointment);
    res.status(201).json(created);
  } catch (err: any) {
    console.error('requestAppointment error:', err);
    res.status(500).json({ message: err.message || 'Error al crear la solicitud.' });
  }
};

export const getMyAppointments = async (req: Request, res: Response): Promise<void> => {
  try {
    const workerId = (req as any).userId as string;

    const items = await Appointment.find({ workerId })
      .sort({ createdAt: -1 });

    res.status(200).json(items);
  } catch (err: any) {
    console.error('getMyAppointments error:', err);
    res.status(500).json({ message: 'Error al obtener tus citas.' });
  }
};

export const getPendingAppointments = async (_req: Request, res: Response): Promise<void> => {
  try {
    const items = await Appointment.find({ status: 'pending' })
      .populate('workerId', 'name lastName email')
      .sort({ createdAt: -1 });

    res.status(200).json(items);
  } catch (err: any) {
    console.error('getPendingAppointments error:', err);
    res.status(500).json({ message: 'Error al listar pendientes.' });
  }
};

export const proposeSlots = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = (req as any).userId as string;
    const { id } = req.params;
    const { proposedSlots } = req.body as { proposedSlots: { start: string; end: string }[] };

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      res.status(404).json({ message: 'Cita no encontrada.' });
      return;
    }
    if (appointment.status !== 'pending' && appointment.status !== 'proposed') {
      res.status(400).json({ message: 'Solo se pueden proponer horarios para solicitudes pendientes o ya propuestas.' });
      return;
    }

    const slots: TimeSlot[] = (proposedSlots || []).map((s) => ({
      start: parseISOToDate(s.start),
      end: parseISOToDate(s.end),
    }));

    validateSlots(slots);
    slots.sort(sortByStartAsc);

    appointment.adminId = new mongoose.Types.ObjectId(adminId);
    appointment.proposedSlots = slots;
    appointment.selectedSlot = null;
    appointment.status = 'proposed';

    const saved = await appointment.save();
    res.status(200).json(saved);
  } catch (err: any) {
    console.error('proposeSlots error:', err);
    res.status(400).json({ message: err.message || 'Error al proponer horarios.' });
  }
};

export const selectSlot = async (req: Request, res: Response): Promise<void> => {
  try {
    const workerId = (req as any).userId as string;
    const { id } = req.params;
    const { selectedSlot } = req.body as { selectedSlot: { start: string; end: string } };

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      res.status(404).json({ message: 'Cita no encontrada.' });
      return;
    }
    if (appointment.workerId.toString() !== workerId) {
      res.status(403).json({ message: 'No autorizado para confirmar esta cita.' });
      return;
    }
    if (appointment.status !== 'proposed') {
      res.status(400).json({ message: 'Solo se puede seleccionar un horario cuando la cita está en estado proposed.' });
      return;
    }

    const sel: TimeSlot = { start: parseISOToDate(selectedSlot.start), end: parseISOToDate(selectedSlot.end) };
    if (!isFuture(sel.start)) {
      res.status(400).json({ message: 'No se puede confirmar un horario en el pasado.' });
      return;
    }

    const belongs = (appointment.proposedSlots || []).some((s) => timeslotEquals(s, sel));
    if (!belongs) {
      res.status(400).json({ message: 'selectedSlot debe pertenecer a proposedSlots.' });
      return;
    }

    appointment.selectedSlot = sel;
    appointment.status = 'confirmed';

    const saved = await appointment.save();
    res.status(200).json(saved);
  } catch (err: any) {
    console.error('selectSlot error:', err);
    res.status(400).json({ message: err.message || 'Error al seleccionar horario.' });
  }
};

export const getCalendarAppointments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    if (!from || !to) {
      res.status(400).json({ message: 'Parámetros from y to son requeridos (YYYY-MM-DD o ISO).' });
      return;
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    const items = await Appointment.find({
      status: { $in: ['confirmed', 'rescheduled'] }, // se muestran confirmadas/reprogramadas
      'selectedSlot.start': { $gte: fromDate, $lte: toDate },
    })
      .populate('workerId', 'name lastName email')
      .populate('adminId', 'name lastName email')
      .sort({ 'selectedSlot.start': 1 });

    res.status(200).json(items);
  } catch (err: any) {
    console.error('getCalendarAppointments error:', err);
    res.status(500).json({ message: 'Error al obtener calendario.' });
  }
};

export const updateAppointment = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = (req as any).userId as string;
    const { id } = req.params;
    const { reason, details, selectedSlot } = req.body as {
      reason?: string;
      details?: string;
      selectedSlot?: { start: string; end: string };
    };

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      res.status(404).json({ message: 'Cita no encontrada.' });
      return;
    }

    let status = appointment.status;

    if (typeof reason === 'string') appointment.reason = reason.trim();
    if (typeof details === 'string') appointment.details = details.trim();

    if (selectedSlot) {
      const sel: TimeSlot = { start: parseISOToDate(selectedSlot.start), end: parseISOToDate(selectedSlot.end) };
      if (!isFuture(sel.start)) {
        res.status(400).json({ message: 'No se puede programar un horario en el pasado.' });
        return;
      }
      appointment.selectedSlot = sel;
      // Al cambiar fecha/hora de una cita confirmada, la marcamos como reprogramada
      status = 'rescheduled';
    }

    appointment.status = status as IAppointment['status'];
    appointment.adminId = new mongoose.Types.ObjectId(adminId);

    const saved = await appointment.save();
    res.status(200).json(saved);
  } catch (err: any) {
    console.error('updateAppointment error:', err);
    res.status(400).json({ message: err.message || 'Error al actualizar la cita.' });
  }
};

export const cancelAppointment = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = (req as any).userId as string;
    const { id } = req.params;

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      res.status(404).json({ message: 'Cita no encontrada.' });
      return;
    }

    appointment.status = 'cancelled';
    appointment.adminId = new mongoose.Types.ObjectId(adminId);

    const saved = await appointment.save();
    res.status(200).json(saved);
  } catch (err: any) {
    console.error('cancelAppointment error:', err);
    res.status(500).json({ message: 'Error al cancelar la cita.' });
  }
};
