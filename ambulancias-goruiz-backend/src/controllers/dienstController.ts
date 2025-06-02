import { Request, Response } from 'express';
import Dienst, { IDienst, IDienstAssignment} from '../models/Dienst';
import { dienstSchema, partialDienstSchema } from '../schemas/dienstSchema';
import { dienstQuerySchema } from '../schemas/dienstQuerySchema';
import { ZodError, z } from 'zod';
import mongoose from 'mongoose';
import { RequestHandler } from 'express';
import { AssignedDay } from '../types/Dienst';

const idSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, {
  message: 'ID no válido',
});

export const createDienst = async (req: Request, res: Response) => {
  try {
    const parsedData = dienstSchema.parse(req.body);
    const newDienst = new Dienst(parsedData);
    const savedDienst = await newDienst.save();
    res.status(201).json(savedDienst);
    return;
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      return;
    }
    res.status(500).json({ message: 'Error al crear Dienst', error });
    return;
  }
};


export const getAllDiensts: RequestHandler = async (req, res) => {
  try {
    const diensts = await Dienst.find()
      .populate('assignments.driver', 'name')
      .populate('assignments.medic', 'name');

    res.status(200).json(diensts);
  } catch (error) {
    console.error("Error al obtener los Diensts:", error);
    res.status(500).json({ message: "Error al obtener los Diensts" });
  }
};


export const getDienstById = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);
    const dienst = await Dienst.findById(parsedId).populate('assignments.driver assignments.medic');
    if (!dienst) {
      res.status(404).json({ message: 'Dienst no encontrado' });
      return;
    }
    res.status(200).json(dienst);
    return;
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: 'ID inválido', errors: error.errors });
      return;
    }
    res.status(500).json({ message: 'Error al obtener el Dienst', error });
    return;
  }
};

export const updateDienst = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);
    const parsedData = dienstSchema.partial().parse(req.body);
    const updatedDienst = await Dienst.findByIdAndUpdate(parsedId, parsedData, { new: true })
      .populate('assignments.driver assignments.medic');
    if (!updatedDienst) {
      res.status(404).json({ message: 'Dienst no encontrado' });
      return;
    }
    res.status(200).json(updatedDienst);
    return;
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      return;
    }
    res.status(500).json({ message: 'Error al actualizar el Dienst', error });
    return;
  }
};

export const updateDienstPartial: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { assignments } = req.body;

  if (!assignments || !Array.isArray(assignments)) {
    res.status(400).json({ message: "No se proporcionaron assignments válidos." });
    return;
  }

  try {
    const dienst = await Dienst.findById(id);
    if (!dienst) {
      res.status(404).json({ message: "Dienst no encontrado." });
      return;
    }

    for (const updatedAssignment of assignments) {
      const index = dienst.assignments.findIndex((a) => a.date === updatedAssignment.date);

      const updatedCopy = { ...updatedAssignment };

      if (updatedCopy.driver === "") updatedCopy.driver = undefined;
      if (updatedCopy.medic === "") updatedCopy.medic = undefined;

      if (
        !updatedCopy.vehicleNumber ||
        !updatedCopy.startTime ||
        !updatedCopy.endTime
      ) {
        console.warn("Assignment incompleto ignorado:", updatedCopy);
        continue;
      }

      if (index !== -1) {
        dienst.assignments[index] = {
          ...dienst.assignments[index],
          ...updatedCopy,
        };
      } else {
        dienst.assignments.push(updatedCopy);
      }
    }

    await dienst.save();
    res.json(dienst);
  } catch (error) {
    console.error("Error al actualizar Dienst:", error);
    res.status(500).json({ message: "Error al actualizar Dienst" });
  }
};


export const deleteDienst = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);
    const deletedDienst = await Dienst.findByIdAndDelete(parsedId);
    if (!deletedDienst) {
      res.status(404).json({ message: 'Dienst no encontrado' });
      return;
    }
    res.status(200).json({ message: 'Dienst eliminado correctamente' });
    return;
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: 'ID inválido', errors: error.errors });
      return;
    }
    res.status(500).json({ message: 'Error al eliminar el Dienst', error });
    return;
  }
};

export const searchDienst = async (req: Request, res: Response) => {
  try {
    const parsedQuery = dienstQuerySchema.parse(req.query);
    const query: any = {};

    if (parsedQuery.dienstNumber) {
      const num = parseInt(parsedQuery.dienstNumber, 10);
      if (!isNaN(num)) query.dienstNumber = num;
    }

    if (parsedQuery.weekStartDate) {
      query.weekStartDate = parsedQuery.weekStartDate;
    }

    if (parsedQuery.date) {
      query['assignments.date'] = parsedQuery.date;
    }

    if (parsedQuery.driver) {
      query['assignments.driver'] = parsedQuery.driver;
    }

    if (parsedQuery.medic) {
      query['assignments.medic'] = parsedQuery.medic;
    }

    const dienste = await Dienst.find(query).populate('assignments.driver assignments.medic');
    res.status(200).json(dienste);
    return;
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: 'Parámetros inválidos', errors: error.errors });
      return;
    }
    res.status(500).json({ message: 'Error al buscar Diensts', error });
    return;
  }
};


export const getDienstsByUser = async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const diensts = await Dienst.find({
      'assignments': {
        $elemMatch: {
          $or: [
            { driver: new mongoose.Types.ObjectId(userId) },
            { medic: new mongoose.Types.ObjectId(userId) }
          ]
        }
      }
    }).populate("assignments.driver", "name")
      .populate("assignments.medic", "name");

    res.status(200).json(diensts);
  } catch (error) {
    console.error('Error fetching diensts:', error);
    res.status(500).json({ message: 'Error fetching diensts', error });
  }
};

// dienstController.ts
export const removeAssignment = async (req: Request, res: Response) => {
  const { date } = req.body;
  const parsedId = idSchema.parse(req.params.id);

  try {
    const updatedDienst = await Dienst.findByIdAndUpdate(
      parsedId,
      { $pull: { assignments: { date } } },
      { new: true }
    ).populate("assignments.driver assignments.medic");

    res.status(200).json(updatedDienst);
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar el assignment", error });
  }
};

export const getAssignedDaysForUser: RequestHandler = async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    res.status(400).json({ message: 'ID de usuario no válido' });
    return;
  }

  try {
    const diensts = await Dienst.find<IDienst>({
      $or: [
        { 'assignments.driver': new mongoose.Types.ObjectId(userId) },
        { 'assignments.medic': new mongoose.Types.ObjectId(userId) }
      ]
    })
      .populate('assignments.driver', 'name')
      .populate('assignments.medic', 'name')
      .lean();

const assignedDays: AssignedDay[] = [];

diensts.forEach((dienst) => {
  dienst.assignments.forEach((assignment: any) => {
    const isAssigned =
      assignment.driver?._id?.toString?.() === userId ||
      assignment.driver?.toString?.() === userId ||
      assignment.medic?._id?.toString?.() === userId ||
      assignment.medic?.toString?.() === userId;

    if (isAssigned) {
      assignedDays.push({
        dienstId: dienst._id.toString(),
        dienstNumber: dienst.dienstNumber,
        date: assignment.date,
        startTime: assignment.startTime,
        endTime: assignment.endTime,
        vehicleNumber: assignment.vehicleNumber,
        driver:
          typeof assignment.driver === "object"
            ? { _id: assignment.driver._id.toString(), name: assignment.driver.name }
            : assignment.driver,
        medic:
          typeof assignment.medic === "object"
            ? { _id: assignment.medic._id.toString(), name: assignment.medic.name }
            : assignment.medic,
      });
    }
  });
});

res.status(200).json(assignedDays);
} catch (error) {
console.error("❌ Error al obtener días asignados:", error);
res.status(500).json({ message: 'Error al obtener días asignados' });
}
};


export const generateDienstTemplatesForWeek: RequestHandler = async (req, res) => {
  const { weekStartDate } = req.body;

  if (!weekStartDate) {
    res.status(400).json({ message: "Fecha de inicio requerida" });
    return;
  }

  try {
    const startDate = new Date(weekStartDate);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    // Verifica si ya existen Diensts para esa semana
    const existing = await Dienst.find({
      weekStartDate: {
        $gte: startDate,
        $lte: endDate,
      },
    });

    if (existing.length > 0) {
      res.status(400).json({ message: "Ya existen Diensts para esa semana" });
      return;
    }

    const diensts = Array.from({ length: 10 }, (_, i) => {
      const dienstNumber = i + 1;
      const assignments = [];

      for (let j = 0; j < 7; j++) {
        const day = new Date(startDate);
        day.setDate(day.getDate() + j);

        const isDayOff = [5, 6].includes((dienstNumber + j) % 7);
        if (isDayOff) continue;

        const startTime = dienstNumber % 2 === 0 ? "06:00" : "14:00";
        const endTime = dienstNumber % 2 === 0 ? "14:00" : "22:00";

        assignments.push({
          date: day.toISOString().split("T")[0],
          vehicleNumber: `AMB-${dienstNumber.toString().padStart(2, "0")}`,
          startTime,
          endTime,
          driver: "000000000000000000000001",
          medic: "000000000000000000000002",
        });
      }

      return {
        dienstNumber,
        weekStartDate: startDate,
        weekEndDate: endDate,
        assignments,
      };
    });

    await Dienst.insertMany(diensts);
    res.status(201).json({ message: "Diensts creados para la semana seleccionada" });
  } catch (error) {
    console.error("❌ Error al generar Diensts:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

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

    res.status(200).json({ message: "Diensts eliminados", count: deleted.deletedCount });
  } catch (error) {
    console.error("Error al eliminar Diensts:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};














