import express from "express";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { requireModule } from "../../middlewares/requireModule";
import { MODULE_KEYS } from "../companies/constants/modules.constants";
import { upload } from "../../middlewares/uploadMiddleware";
import { validateBody } from "../../middlewares/validateBody";
import { validateObjectId } from "../../middlewares/validateObjectId";
import {
  createSickLeave,
  acceptSickLeave,
  rejectSickLeave,
  removeMyRejectedSickLeave,
  sickLeaveCreateSchema,
} from "./controllers/sick-leaves-write.controller";
import {
  attachSickDocument,
  attachSickDocumentFile,
} from "./controllers/sick-documents.controller";
import {
  checkSickInRange,
  listMySickLeaves,
  listSickLeaves,
} from "./controllers/sick-leaves-read.controller";

const router = express.Router();

router.post(
  "/",
  authenticateToken,
  requireModule(MODULE_KEYS.SICK_LEAVES),
  validateBody(sickLeaveCreateSchema),
  createSickLeave,
);

router.get(
  "/",
  authenticateToken,
  requireModule(MODULE_KEYS.SICK_LEAVES),
  authorizeRole("admin"),
  listSickLeaves,
);

router.get(
  "/mine",
  authenticateToken,
  requireModule(MODULE_KEYS.SICK_LEAVES),
  listMySickLeaves,
);

router.post(
  "/:id/accept",
  authenticateToken,
  requireModule(MODULE_KEYS.SICK_LEAVES),
  authorizeRole("admin"),
  validateObjectId("id"),
  acceptSickLeave,
);

router.post(
  "/:id/reject",
  authenticateToken,
  requireModule(MODULE_KEYS.SICK_LEAVES),
  authorizeRole("admin"),
  validateObjectId("id"),
  rejectSickLeave,
);

router.post(
  "/:id/attach-document",
  authenticateToken,
  requireModule(MODULE_KEYS.SICK_LEAVES),
  validateObjectId("id"),
  attachSickDocument,
);

router.post(
  "/:id/attach-document-file",
  authenticateToken,
  requireModule(MODULE_KEYS.SICK_LEAVES),
  validateObjectId("id"),
  upload.single("document"),
  attachSickDocumentFile,
);

router.delete(
  "/:id/mine",
  authenticateToken,
  requireModule(MODULE_KEYS.SICK_LEAVES),
  validateObjectId("id"),
  removeMyRejectedSickLeave,
);

router.post(
  "/check-range",
  authenticateToken,
  requireModule(MODULE_KEYS.SICK_LEAVES),
  authorizeRole("admin"),
  checkSickInRange,
);

export default router;
