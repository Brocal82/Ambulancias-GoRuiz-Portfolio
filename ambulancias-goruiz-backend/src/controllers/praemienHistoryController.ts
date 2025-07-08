import { Request, Response } from "express";
import MonthlyPraemie from "../models/MonthlyPraemie";
import WorkdaySummary from "../models/workdaySummary";
import { startOfMonth, endOfMonth } from "date-fns";

/**
 * Controlador que calcula y guarda la media mensual de prämien para un usuario
 */
export const saveMonthlyPraemie = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    // Opcional: año y mes pueden venir en query, si no usar mes actual
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || new Date().getMonth() + 1; // JS meses base 0

    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(new Date(year, month - 1));

    // Obtener workdays cerrados para ese usuario y mes
    const summaries = await WorkdaySummary.find({
      date: { $gte: monthStart.toISOString().split("T")[0], $lte: monthEnd.toISOString().split("T")[0] },
      $or: [{ driver: userId }, { medic: userId }],
      isFinalClosure: true,
    }).select("totalEffectivePatients");

    if (!summaries.length) {
      res.status(200).json({ message: "No hay datos para ese mes" });
      return;
    }

    const totalPatients = summaries.reduce((acc, s) => acc + s.totalEffectivePatients, 0);
    const averagePatients = totalPatients / summaries.length;

    // Determinar nivel premio
    let premieLevel = "❌ No alcanza mínimo";
    if (averagePatients >= 10) premieLevel = "🏆 Prämie 10";
    else if (averagePatients >= 9) premieLevel = "🎖 Prämie 9";
    else if (averagePatients >= 8) premieLevel = "🥈 Prämie 8";
    else if (averagePatients >= 7) premieLevel = "🥉 Prämie 7";

    // Guardar o actualizar registro mensual
    const updated = await MonthlyPraemie.findOneAndUpdate(
      { userId, year, month },
      {
        userId,
        year,
        month,
        averagePatients,
        premieLevel,
        createdAt: new Date(),
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ message: "Monthly prämie guardada", data: updated });
  } catch (error) {
    console.error("Error en saveMonthlyPraemie:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
