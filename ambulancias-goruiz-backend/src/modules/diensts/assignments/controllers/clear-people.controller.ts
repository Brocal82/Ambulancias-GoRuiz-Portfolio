import { Request, Response } from "express";
import Dienst from "../../../../models/Dienst";

// ✅ Limpiar driver/medic/ambulancia de TODA la semana del Dienst (mantiene horas)
export const clearPeopleForWeek = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { dienstNumber, weekStartDate } = req.body as {
      dienstNumber?: number;
      weekStartDate?: string; // 'YYYY-MM-DD'
    };

    if (!dienstNumber || !weekStartDate) {
      res
        .status(400)
        .json({ message: "Faltan parámetros: dienstNumber, weekStartDate" });
      return;
    }

    const start = new Date(weekStartDate);
    if (isNaN(start.getTime())) {
      res.status(400).json({ message: "weekStartDate inválida" });
      return;
    }

    // Buscar Dienst por número y día exacto de inicio de semana
    const dienst = await Dienst.findOne({
      dienstNumber,
      weekStartDate: {
        $gte: start,
        $lt: new Date(start.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    if (!dienst) {
      res
        .status(404)
        .json({ message: "No existe Dienst para esa semana y número" });
      return;
    }

    let clearedCount = 0;

    dienst.assignments = dienst.assignments.map((a) => {
      if (!a?.date || !a?.startTime || !a?.endTime) return a;
      const hadSomething = !!a.driver || !!a.medic || !!a.ambulanceId;
      if (hadSomething) clearedCount += 1;

      return {
        ...a,
        driver: undefined,
        medic: undefined,
        ambulanceId: undefined, // 👈 ahora también se limpia la ambulancia
      } as any;
    });

    // ✅ Al limpiar personas, también limpiamos el ancla semanal
    (dienst as any).weekTeamId = null;

    await dienst.save();

    res.status(200).json({
      message: `Asignaciones (driver/medic/ambulancia) limpiadas para Dienst #${dienstNumber} (${weekStartDate}).`,
      clearedCount,
      dienstId: dienst.id,
      weekStartDate,
    });
  } catch (error) {
    console.error("❌ Error en clearPeopleForWeek:", error);
    res
      .status(500)
      .json({ message: "Error al limpiar asignaciones de la semana" });
  }
};
