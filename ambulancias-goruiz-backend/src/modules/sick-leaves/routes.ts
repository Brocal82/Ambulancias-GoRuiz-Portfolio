import express from "express";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { upload } from "../../middlewares/uploadMiddleware";
import { validateObjectId } from "../../middlewares/validateObjectId";
import {
  createSickLeave,
  acceptSickLeave,
  rejectSickLeave,
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

router.post("/", authenticateToken, createSickLeave);

router.get("/", authenticateToken, authorizeRole("admin"), listSickLeaves);

router.get("/mine", authenticateToken, listMySickLeaves);

router.post(
  "/:id/accept",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  acceptSickLeave,
);

router.post(
  "/:id/reject",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  rejectSickLeave,
);

router.post(
  "/:id/attach-document",
  authenticateToken,
  validateObjectId("id"),
  attachSickDocument,
);

router.post(
  "/:id/attach-document-file",
  authenticateToken,
  validateObjectId("id"),
  upload.single("document"),
  attachSickDocumentFile,
);

router.post(
  "/check-range",
  authenticateToken,
  authorizeRole("admin"),
  checkSickInRange,
);

export default router;
