import { Request, Response } from "express";
import { z } from "zod";
import * as assignmentsService from "../services/assignments.service";

const idSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, {
  message: "ID no válido",
});

export const removeAssignment = async (req: Request, res: Response) => {
  const { date } = req.body;
  try {
    const parsedId = idSchema.parse(req.params.id);
    const updatedDienst = await assignmentsService.removeAssignment(
      parsedId,
      date,
      req.companyId ?? undefined,
    );
    res.status(200).json(updatedDienst);
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar el assignment", error });
  }
};
