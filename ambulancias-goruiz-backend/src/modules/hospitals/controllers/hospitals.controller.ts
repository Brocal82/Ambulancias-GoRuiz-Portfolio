import { Request, Response } from "express";
import mongoose from "mongoose";
import * as hospitalsService from "../services/hospitals.service";
import type {
  CreateHospitalInput,
  UpdateHospitalInput,
} from "../schemas/hospital.schema";
import { HospitalInUseError } from "../utils/hospitalReferences";
import { requireCompanyForAdmin } from "../../../utils/requireCompany";

function resolveCompanyId(req: Request): {
  companyId: string | null;
  ok: boolean;
  statusCode?: number;
  message?: string;
} {
  if (req.userRole === "admin") {
    const result = requireCompanyForAdmin(req);
    if (!result.ok)
      return {
        companyId: null,
        ok: false,
        statusCode: result.statusCode,
        message: result.message,
      };
    return { companyId: result.companyId, ok: true };
  }
  return { companyId: req.companyId ?? null, ok: true };
}

export const getAllHospitals = async (req: Request, res: Response) => {
  try {
    const { companyId, ok, statusCode, message } = resolveCompanyId(req);
    if (!ok) {
      res.status(statusCode!).json({ message });
      return;
    }
    const rawCompanyId = companyId != null ? String(companyId).trim() : "";
    if (!rawCompanyId || !mongoose.Types.ObjectId.isValid(rawCompanyId)) {
      res.status(403).json({
        message: "No tienes permiso. Se requiere un contexto de empresa válido.",
      });
      return;
    }
    const hospitals = await hospitalsService.getAllHospitals(rawCompanyId);
    res.status(200).json(hospitals);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los hospitales" });
  }
};

export const createHospital = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const saved = await hospitalsService.createHospital(
      req.body as CreateHospitalInput,
      companyResult.companyId,
    );
    res.status(201).json(saved);
  } catch (error) {
    console.error("Error al crear hospital:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const updateHospital = async (req: Request, res: Response) => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const updateData = req.body as UpdateHospitalInput;
    const updated = await hospitalsService.updateHospital(
      req.params.id,
      updateData,
      companyResult.companyId,
    );
    if (!updated) {
      res.status(404).json({ message: "Hospital no encontrado" });
      return;
    }
    res.status(200).json(updated);
  } catch (error) {
    console.error("❌ Error al actualizar hospital:", error);
    res.status(400).json({ message: "Error al actualizar el hospital" });
  }
};

export const deleteHospital = async (req: Request, res: Response) => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const deleted = await hospitalsService.deleteHospital(
      req.params.id,
      companyResult.companyId,
    );
    if (!deleted) {
      res.status(404).json({ message: "Hospital no encontrado" });
      return;
    }
    res.status(200).json({ message: "Hospital eliminado" });
  } catch (error) {
    if (error instanceof HospitalInUseError) {
      res.status(409).json({ message: error.message, sources: error.sources });
      return;
    }
    res.status(400).json({ message: "Error al eliminar el hospital" });
  }
};
