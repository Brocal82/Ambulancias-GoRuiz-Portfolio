import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";

/**
 * Middleware factory: valida req.body con un schema Zod.
 * Si es válido, asigna el resultado parseado a req.body y continúa.
 * Si falla, pasa ZodError a next() para que errorHandler lo formatee (400).
 */
export const validateBody = <T>(schema: ZodType<T>) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body) as Request["body"];
      next();
    } catch (err) {
      next(err);
    }
  };
};
