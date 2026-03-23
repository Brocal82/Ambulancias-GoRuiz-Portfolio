import { Request, Response } from "express";
import { ZodError, z } from "zod";
import { dienstSchema } from "../../schemas/dienstSchema";
import * as lifecycleService from "../services/lifecycle.service";
import { requireCompanyForAdmin, CompanyValidationError } from "../../../../utils/requireCompany";

const idSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, {
  message: "ID no válido",
});

export const createDienst = async (req: Request, res: Response) => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const parsedData = dienstSchema.parse(req.body);
    const savedDienst = await lifecycleService.createDienst(
      parsedData,
      companyResult.companyId,
    );
    res.status(201).json(savedDienst);
  } catch (error) {
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({ message: "Datos inválidos", errors: error.errors });
      return;
    }
    if (error instanceof CompanyValidationError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: "Error al crear Dienst", error });
  }
};

export const updateDienst = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);
    const updatedDienst = await lifecycleService.updateDienst(
      parsedId,
      dienstSchema.partial().parse(req.body),
      req.companyId ?? undefined,
    );
    if (!updatedDienst) {
      res.status(404).json({ message: "Dienst no encontrado" });
      return;
    }
    res.status(200).json(updatedDienst);
  } catch (error) {
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({ message: "Datos inválidos", errors: error.errors });
    } else {
      res.status(500).json({ message: "Error al actualizar el Dienst", error });
    }
  }
};

export const deleteDienst = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);
    const deletedDienst = await lifecycleService.deleteDienst(
      parsedId,
      req.companyId ?? undefined,
    );
    if (!deletedDienst) {
      res.status(404).json({ message: "Dienst no encontrado" });
      return;
    }
    res.status(200).json({ message: "Dienst eliminado correctamente" });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: "ID inválido", errors: error.errors });
    } else {
      res.status(500).json({ message: "Error al eliminar el Dienst", error });
    }
  }
};
