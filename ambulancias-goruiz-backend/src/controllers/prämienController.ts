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

/**
 * Controlador que devuelve el histórico mensual de prämien (media pacientes por mes)
 * para el usuario logueado.
 */
export const getPraemienMonthlyHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      res.status(401).json({ message: 'No autorizado' });
      return;
    }

    // Obtenemos todos los registros finales (cierres totales) para este usuario
    const summaries = await WorkdaySummary.find({
      $or: [{ driver: userId }, { medic: userId }],
      isFinalClosure: true,
    }).select('date totalEffectivePatients');

    if (!summaries.length) {
      res.status(200).json([]);
      return;
    }

    // Agrupar por año y mes
    const monthlyGroups: Record<string, { totalPatients: number; days: number }> = {};

    summaries.forEach((summary) => {
      const date = new Date(summary.date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // Mes 1-12

      const key = `${year}-${month}`;

      if (!monthlyGroups[key]) {
        monthlyGroups[key] = { totalPatients: 0, days: 0 };
      }
      monthlyGroups[key].totalPatients += summary.totalEffectivePatients || 0;
      monthlyGroups[key].days += 1;
    });

    // Construir array resultado
    const result = Object.entries(monthlyGroups).map(([key, value]) => {
      const [yearStr, monthStr] = key.split('-');
      const averagePatients = value.totalPatients / value.days;
      return {
        year: Number(yearStr),
        month: Number(monthStr),
        averagePatients: Number(averagePatients.toFixed(2)),
      };
    });

    // Ordenar de más reciente a más antiguo
    result.sort((a, b) => (b.year - a.year) || (b.month - a.month));

    res.status(200).json(result);

  } catch (error) {
    console.error('Error en getPraemienMonthlyHistory:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};
