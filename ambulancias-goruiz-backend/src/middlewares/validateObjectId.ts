import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

/**
 * Middleware factory: valida que req.params[paramName] sea un ObjectId válido.
 * Devuelve 400 con mensaje claro si el ID es inválido.
 * Reutilizable para cualquier ruta con parámetro de ID.
 */
export const validateObjectId = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[paramName];

    if (!value) {
      next();
      return;
    }

    if (!mongoose.isValidObjectId(value)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }

    next();
  };
};
