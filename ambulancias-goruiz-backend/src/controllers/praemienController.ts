import { Request, Response } from 'express';
import WorkdaySummary from '../models/workdaySummary';
import { startOfMonth, endOfMonth } from 'date-fns';
import mongoose from 'mongoose';

/**
 * Controlador que devuelve para el usuario logueado o el userId de query:
 * - lista de días con la cantidad total de pacientes efectivos (sumando cierres parciales y totales)
 * - media diaria de pacientes en el mes actual
 */
export const getMonthlyPraemienSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const userIdFromQuery = req.query.userId as string | undefined;
    const userId = userIdFromQuery || (req as any).userId;
    
    if (!userId) {
      res.status(401).json({ message: 'No autorizado' });
      return;
    }

    const objectUserId = new mongoose.Types.ObjectId(userId);

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const summaries = await WorkdaySummary.find({
      date: { $gte: monthStart.toISOString().split('T')[0], $lte: monthEnd.toISOString().split('T')[0] },
      $or: [{ driver: objectUserId }, { medic: objectUserId }],
    }).select('date totalEffectivePatients');

    if (!summaries.length) {
      res.status(200).json({
        monthlyData: [],
        averagePatients: 0,
      });
      return;
    }

    const groupedByDate: Record<string, number> = {};

    summaries.forEach((s) => {
      const dateKey = s.date.toString().split('T')[0];
      if (!groupedByDate[dateKey]) groupedByDate[dateKey] = 0;
      groupedByDate[dateKey] += s.totalEffectivePatients || 0;
    });

    const monthlyData = Object.entries(groupedByDate).map(([date, totalCountedPatients]) => ({
      date,
      totalCountedPatients,
    }));

    const totalPatients = monthlyData.reduce((acc, day) => acc + day.totalCountedPatients, 0);
    const averagePatients = totalPatients / monthlyData.length;

    res.status(200).json({
      monthlyData,
      averagePatients: Number(averagePatients.toFixed(2)),
    });
  } catch (error) {
    console.error('Error en getMonthlyPraemienSummary:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * Controlador que devuelve el histórico mensual de prämien (media pacientes por mes)
 * para el usuario logueado o el userId en query.
 */
export const getPraemienMonthlyHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userIdFromQuery = req.query.userId as string | undefined;
    const userId = userIdFromQuery || (req as any).userId;

    if (!userId) {
      res.status(401).json({ message: 'No autorizado' });
      return;
    }

    const objectUserId = new mongoose.Types.ObjectId(userId);

    const summaries = await WorkdaySummary.find({
      $or: [{ driver: objectUserId }, { medic: objectUserId }],
      // Incluye cierres parciales y finales
    }).select('date totalEffectivePatients');


    if (!summaries.length) {
      res.status(200).json([]);
      return;
    }

    const groupedByDate: Record<string, number> = {};

    summaries.forEach((summary) => {
      const dateKey = summary.date.toString().split('T')[0];
      if (!groupedByDate[dateKey]) groupedByDate[dateKey] = 0;
      groupedByDate[dateKey] += summary.totalEffectivePatients || 0;
    });

    const monthlyGroups: Record<string, { totalPatients: number; days: number }> = {};

    Object.entries(groupedByDate).forEach(([dateStr, totalPatients]) => {
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      const key = `${year}-${month}`;

      if (!monthlyGroups[key]) monthlyGroups[key] = { totalPatients: 0, days: 0 };
      monthlyGroups[key].totalPatients += totalPatients;
      monthlyGroups[key].days += 1;
    });

    // Obtener mes y año actuales para filtrar
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Construir array resultado excluyendo mes actual
    const result = Object.entries(monthlyGroups)
      .map(([key, value]) => {
        const [yearStr, monthStr] = key.split('-');
        const year = Number(yearStr);
        const month = Number(monthStr);
        const averagePatients = value.totalPatients / value.days;
        return {
          year,
          month,
          averagePatients: Number(averagePatients.toFixed(2)),
        };
      })
      .filter(({ year, month }) => !(year === currentYear && month === currentMonth)) // Excluir mes actual
      .sort((a, b) => (b.year - a.year) || (b.month - a.month));

    res.status(200).json(result);

  } catch (error) {
    console.error('Error en getPraemienMonthlyHistory:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

