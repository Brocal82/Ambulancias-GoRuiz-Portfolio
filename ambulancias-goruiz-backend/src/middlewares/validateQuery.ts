import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";

/**
 * Middleware factory: valida req.query con un schema Zod.
 * Si es válido, asigna el resultado parseado a req.query y continúa.
 * Si falla, pasa ZodError a next() para que errorHandler lo formatee (400).
 */
export const validateQuery = <T>(schema: ZodType<T>) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as Request["query"];
      next();
    } catch (err) {
      next(err);
    }
  };
};
