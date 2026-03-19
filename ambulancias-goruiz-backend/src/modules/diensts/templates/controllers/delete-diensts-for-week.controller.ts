import { RequestHandler } from "express";
import Dienst from "../../../../models/Dienst";

export const deleteDienstsForWeek: RequestHandler = async (req, res) => {
  const { weekStartDate } = req.body;

  if (!weekStartDate) {
    res.status(400).json({ message: "Fecha de inicio requerida" });
    return;
  }

  try {
    const start = new Date(weekStartDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const deleted = await Dienst.deleteMany({
      weekStartDate: {
        $gte: start,
        $lte: end,
      },
    });

    res
      .status(200)
      .json({ message: "Diensts eliminados", count: deleted.deletedCount });
  } catch (error) {
    console.error("Error al eliminar Diensts:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
