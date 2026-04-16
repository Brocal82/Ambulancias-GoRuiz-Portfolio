import { Router } from "express";
import multer from "multer";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { upload } from "../../middlewares/uploadMiddleware";
import {
  deleteCompanyDocumentsBatch,
  deleteCompanyDocument,
  listCompanyDocuments,
  uploadCompanyDocument,
  uploadCompanyDocumentsBatch,
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

router.post(
  "/upload/batch",
  authenticateToken,
  authorizeRole("admin"),
  upload.array("files", 50),
  uploadCompanyDocumentsBatch,
);

router.get(
  "/",
  authenticateToken,
  authorizeRole("admin"),
  listCompanyDocuments,
);

router.delete(
  "/batch/:uploadBatchId",
  authenticateToken,
  authorizeRole("admin"),
  deleteCompanyDocumentsBatch,
);

router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  deleteCompanyDocument,
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

