//backend/src/controllers/vacationController.ts
import { Request, Response } from 'express';
import type { IVacationRequestModel } from '../models/vacationRequest';
import VacationRequest from '../models/vacationRequest';
import mongoose from 'mongoose';

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
  try {
    const { id } = req.params;
    const { status, adminOptionStartDate, adminOptionEndDate, adminNote } = req.body;

    const request = await VacationRequest.findById(id) as IVacationRequestModel | null;
    if (!request) {
      res.status(404).json({ message: 'Solicitud no encontrada' });
      return;
    }

    if (status) request.status = status;
    if (adminOptionStartDate) request.adminOptionStartDate = new Date(adminOptionStartDate);
    if (adminOptionEndDate) request.adminOptionEndDate = new Date(adminOptionEndDate);
    if (adminNote) request.adminNote = adminNote;

    await request.save();

    res.status(200).json(request);
  } catch (error) {
    console.error('Error al actualizar solicitud de vacaciones:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
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


