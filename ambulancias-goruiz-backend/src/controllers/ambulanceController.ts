import { Request, Response } from "express";
import Ambulance from "../models/Ambulance";

// Obtener todas las ambulancias
export const getAllAmbulances = async (req: Request, res: Response) => {
  try {
    const ambulances = await Ambulance.find();
    res.status(200).json(ambulances);
  } catch (error) {
    console.error("Error fetching ambulances:", error);
    res.status(500).json({ message: "Error fetching ambulances" });
  }
};

// Obtener una ambulancia por ID
export const getAmbulanceById = async (req: Request, res: Response) => {
  try {
    const ambulance = await Ambulance.findById(req.params.id);
    if (!ambulance) {
      res.status(404).json({ message: "Ambulance not found" });
      return;
    }
    res.status(200).json(ambulance);
  } catch (error) {
    console.error("Error fetching ambulance:", error);
    res.status(500).json({ message: "Error fetching ambulance" });
  }
};

// Crear una nueva ambulancia
export const createAmbulance = async (req: Request, res: Response) => {
  try {
    const newAmbulance = new Ambulance(req.body);
    await newAmbulance.save();
    res.status(201).json(newAmbulance);
  } catch (error) {
    console.error("Error creating ambulance:", error);
    res.status(500).json({ message: "Error creating ambulance" });
  }
};

// Actualizar una ambulancia existente
export const updateAmbulance = async (req: Request, res: Response) => {
  try {
    const updated = await Ambulance.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated) {
      res.status(404).json({ message: "Ambulance not found" });
      return;
    }
    res.status(200).json(updated);
  } catch (error) {
    console.error("Error updating ambulance:", error);
    res.status(500).json({ message: "Error updating ambulance" });
  }
};

// Eliminar una ambulancia
export const deleteAmbulance = async (req: Request, res: Response) => {
  try {
    const deleted = await Ambulance.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ message: "Ambulance not found" });
      return;
    }
    res.status(200).json({ message: "Ambulance deleted" });
  } catch (error) {
    console.error("Error deleting ambulance:", error);
    res.status(500).json({ message: "Error deleting ambulance" });
  }
};
