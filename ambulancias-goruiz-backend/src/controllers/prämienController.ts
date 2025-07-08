import { Request, Response } from 'express';
import WorkdaySummary from '../models/workdaySummary';
import { startOfMonth, endOfMonth } from 'date-fns';

/**
 * Controlador que devuelve para el usuario logueado:
 * - lista de días con la cantidad total de pacientes efectivos (sumando cierres parciales y totales)
 * - media diaria de pacientes en el mes actual
 */
export const getMonthlyPraemienSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId; // acceder a userId inyectado por el middleware
    if (!userId) {
      res.status(401).json({ message: 'No autorizado' });
      return;
    }

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Obtener todos los WorkdaySummary del mes actual para el usuario, sin filtrar por isFinalClosure
    const summaries = await WorkdaySummary.find({
      date: { $gte: monthStart.toISOString().split('T')[0], $lte: monthEnd.toISOString().split('T')[0] },
      $or: [{ driver: userId }, { medic: userId }],
    }).select('date totalEffectivePatients');

    if (!summaries.length) {
      res.status(200).json({
        monthlyData: [],
        averagePatients: 0,
      });
      return;
    }

    // Agrupar por fecha sumando pacientes de cierres parciales y totales
    const groupedByDate: Record<string, number> = {};

    summaries.forEach((s) => {
      const dateKey = s.date.toString().split('T')[0];
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = 0;
      }
      groupedByDate[dateKey] += s.totalEffectivePatients || 0;
    });

    // Convertir el objeto agrupado en array para el frontend
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
