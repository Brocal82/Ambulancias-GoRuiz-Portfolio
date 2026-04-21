import { Router } from "express";
import multer from "multer";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { requireModule } from "../../middlewares/requireModule";
import { validateObjectId } from "../../middlewares/validateObjectId";
import { upload } from "../../middlewares/uploadMiddleware";
import {
  acknowledgeMyDocumentDelivery,
  deleteCompanyDocumentsBatch,
  deleteCompanyDocument,
  listCompanyDocuments,
  listMyDocumentDeliveries,
  markMyDocumentDeliveryRead,
  uploadCompanyDocument,
  uploadCompanyDocumentsBatch,
} from "./document.controller";
import type { ErrorRequestHandler } from "express";
import { MODULE_KEYS } from "../companies/constants/modules.constants";

const router = Router();

router.get(
  "/mine",
  authenticateToken,
  requireModule(MODULE_KEYS.DOCUMENTS),
  authorizeRole("worker"),
  listMyDocumentDeliveries,
);

router.patch(
  "/deliveries/:deliveryId/read",
  authenticateToken,
  requireModule(MODULE_KEYS.DOCUMENTS),
  authorizeRole("worker"),
  validateObjectId("deliveryId"),
  markMyDocumentDeliveryRead,
);

router.post(
  "/deliveries/:deliveryId/acknowledge",
  authenticateToken,
  requireModule(MODULE_KEYS.DOCUMENTS),
  authorizeRole("worker"),
  validateObjectId("deliveryId"),
  acknowledgeMyDocumentDelivery,
);

router.post(
  "/upload",
  authenticateToken,
  requireModule(MODULE_KEYS.DOCUMENTS),
  authorizeRole("admin"),
  upload.single("file"),
  uploadCompanyDocument,
);

router.post(
  "/upload/batch",
  authenticateToken,
  requireModule(MODULE_KEYS.DOCUMENTS),
  authorizeRole("admin"),
  upload.array("files", 50),
  uploadCompanyDocumentsBatch,
);

router.get(
  "/",
  authenticateToken,
  requireModule(MODULE_KEYS.DOCUMENTS),
  authorizeRole("admin"),
  listCompanyDocuments,
);

router.delete(
  "/batch/:uploadBatchId",
  authenticateToken,
  requireModule(MODULE_KEYS.DOCUMENTS),
  authorizeRole("admin"),
  deleteCompanyDocumentsBatch,
);

router.delete(
  "/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.DOCUMENTS),
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

