// backend/src/middlewares/notFoundHandler.ts
import type { Request, Response } from "express";

/**
 * Middleware 404: captura rutas no encontradas.
 * Debe ir después de todas las rutas y antes del errorHandler.
 * Formato coherente con errorHandler: { message: string }.
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ message: "Ruta no encontrada" });
}
