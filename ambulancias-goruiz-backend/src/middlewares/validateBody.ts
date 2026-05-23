import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";
import { unlinkMulterFiles } from "../utils/unlinkUploadedFiles";

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

/**
 * Igual que validateBody, pero elimina ficheros Multer en req.files si la validación falla.
 */
export const validateBodyWithUploadCleanup = <T>(schema: ZodType<T>) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const uploaded = (req as Request & { files?: Express.Multer.File[] }).files;
    const files = Array.isArray(uploaded) ? uploaded : undefined;
    try {
      req.body = schema.parse(req.body) as Request["body"];
      next();
    } catch (err) {
      await unlinkMulterFiles(files);
      next(err);
    }
  };
};
