import { Router } from "express";
import multer from "multer";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { upload } from "../../middlewares/uploadMiddleware";
import {
  listCompanyDocuments,
  uploadCompanyDocument,
} from "./document.controller";
import type { ErrorRequestHandler } from "express";

const router = Router();

router.post(
  "/upload",
  authenticateToken,
  authorizeRole("admin"),
  upload.single("file"),
  uploadCompanyDocument,
);

router.get(
  "/",
  authenticateToken,
  authorizeRole("admin"),
  listCompanyDocuments,
);

const multerErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ message: `Upload error: ${err.message}` });
    return;
  }

  if (
    err &&
    typeof err.message === "string" &&
    err.message.includes("Tipo de archivo no permitido")
  ) {
    res.status(400).json({ message: err.message });
    return;
  }

  res.status(500).json({ message: "Unexpected server error" });
};

router.use(multerErrorHandler);

export default router;

