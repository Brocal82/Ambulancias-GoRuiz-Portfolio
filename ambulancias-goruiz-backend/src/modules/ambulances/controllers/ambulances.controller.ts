import { Request, Response, NextFunction } from "express";
import * as ambulancesService from "../services/ambulances.service";

export const getAllAmbulances = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ambulances = await ambulancesService.getAllAmbulances();
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
    const ambulance = await ambulancesService.getAmbulanceById(req.params.id);
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
    const newAmbulance = await ambulancesService.createAmbulance(req.body);
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
    const updated = await ambulancesService.updateAmbulance(
      req.params.id,
      req.body
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
    const deleted = await ambulancesService.deleteAmbulance(req.params.id);
    if (!deleted) {
      res.status(404).json({ message: "Ambulance not found" });
      return;
    }
    res.status(200).json({ message: "Ambulance deleted" });
  } catch (error) {
    next(error);
  }
};
