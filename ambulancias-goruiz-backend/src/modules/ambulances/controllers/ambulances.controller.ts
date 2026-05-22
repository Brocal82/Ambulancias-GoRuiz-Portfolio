import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import * as ambulancesService from "../services/ambulances.service";
import {
  requireCompanyForAdmin,
  requireCompanyForAmbulanceMutations,
} from "../../../utils/requireCompany";
import { AmbulanceInUseError } from "../utils/ambulanceReferences";

function resolveCompanyId(req: Request): { companyId: string | null; ok: boolean; statusCode?: number; message?: string } {
  if (req.userRole === "admin") {
    const result = requireCompanyForAdmin(req);
    if (!result.ok) return { companyId: null, ok: false, statusCode: result.statusCode, message: result.message };
    return { companyId: result.companyId, ok: true };
  }
  return { companyId: req.companyId ?? null, ok: true };
}

export const getAllAmbulances = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
    const ambulances = await ambulancesService.getAllAmbulances(rawCompanyId);
    res.status(200).json(ambulances);
  } catch (error) {
    next(error);
  }
};

export const getAmbulanceById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
    const ambulance = await ambulancesService.getAmbulanceById(req.params.id, rawCompanyId);
    if (!ambulance) {
      res.status(404).json({ message: "Ambulance not found" });
      return;
    }
    res.status(200).json(ambulance);
  } catch (error) {
    next(error);
  }
};

export const createAmbulance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyResult = requireCompanyForAmbulanceMutations(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const newAmbulance = await ambulancesService.createAmbulance(
      req.body,
      companyResult.companyId
    );
    res.status(201).json(newAmbulance);
  } catch (error) {
    next(error);
  }
};

export const updateAmbulance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyResult = requireCompanyForAmbulanceMutations(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const updated = await ambulancesService.updateAmbulance(
      req.params.id,
      req.body,
      companyResult.companyId
    );
    if (!updated) {
      res.status(404).json({ message: "Ambulance not found" });
      return;
    }
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

export const deleteAmbulance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyResult = requireCompanyForAmbulanceMutations(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const deleted = await ambulancesService.deleteAmbulance(
      req.params.id,
      companyResult.companyId
    );
    if (!deleted) {
      res.status(404).json({ message: "Ambulance not found" });
      return;
    }
    res.status(200).json({ message: "Ambulance deleted" });
  } catch (error) {
    if (error instanceof AmbulanceInUseError) {
      res.status(409).json({ message: error.message, sources: error.sources });
      return;
    }
    next(error);
  }
};
