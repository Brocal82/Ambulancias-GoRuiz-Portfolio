// backend/src/middlewares/errorHandler.ts
import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

/**
 * Middleware global de errores. Debe ir después de todas las rutas.
 * Captura errores pasados con next(err) y errores no manejados.
 * Devuelve siempre { message: string } para compatibilidad con el frontend.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // ZodError: validación fallida → 400
  if (err instanceof ZodError) {
    const first = err.errors[0];
    const message =
      first?.path?.length
        ? `${first.path.join(".")}: ${first.message}`
        : first?.message ?? "Datos inválidos";
    res.status(400).json({ message });
    return;
  }

  // Mongo duplicate key (E11000) → 400
  if (
    err &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  ) {
    res.status(400).json({
      message: "Ya existe un registro con ese valor único",
    });
    return;
  }

  // Error estándar con mensaje
  if (err instanceof Error) {
    const errWithStatus = err as { status?: number; statusCode?: number };
    const status =
      typeof errWithStatus.statusCode === "number"
        ? errWithStatus.statusCode
        : typeof errWithStatus.status === "number"
          ? errWithStatus.status
          : 500;
    res.status(status).json({ message: err.message || "Error interno del servidor" });
    return;
  }

  // Fallback: error desconocido
  res.status(500).json({ message: "Error interno del servidor" });
}
