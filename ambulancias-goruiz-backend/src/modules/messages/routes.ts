import { Router } from "express";
import multer from "multer";
import {
  createMessage,
  getMyMessages,
  getSentMessages,
  deleteMessageForUser,
  deleteMessageByAdmin,
  markMessageAsRead,
  getMessagesForUserAsAdmin,
} from "./controllers/messages.controller";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { requireModule } from "../../middlewares/requireModule";
import { validateBodyWithUploadCleanup } from "../../middlewares/validateBody";
import { upload } from "../../middlewares/uploadMiddleware";
import { validateObjectId } from "../../middlewares/validateObjectId";
import { messageSchema } from "./schemas/message.schema";
import type { ErrorRequestHandler } from "express";
import { MODULE_KEYS } from "../companies/constants/modules.constants";

const router = Router();

router.post(
  "/",
  authenticateToken,
  requireModule(MODULE_KEYS.MESSAGES),
  authorizeRole("admin"),
  upload.array("attachment", 5),
  validateBodyWithUploadCleanup(messageSchema),
  createMessage,
);

router.get("/", authenticateToken, requireModule(MODULE_KEYS.MESSAGES), authorizeRole("worker"), getMyMessages);

router.get("/sent", authenticateToken, requireModule(MODULE_KEYS.MESSAGES), authorizeRole("admin"), getSentMessages);

router.get(
  "/user/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.MESSAGES),
  authorizeRole("admin"),
  validateObjectId("id"),
  getMessagesForUserAsAdmin,
);

router.patch(
  "/:id/read",
  authenticateToken,
  requireModule(MODULE_KEYS.MESSAGES),
  authorizeRole("worker"),
  validateObjectId("id"),
  markMessageAsRead,
);

router.patch(
  "/:id/remove",
  authenticateToken,
  requireModule(MODULE_KEYS.MESSAGES),
  authorizeRole("worker"),
  validateObjectId("id"),
  deleteMessageForUser,
);

router.delete(
  "/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.MESSAGES),
  authorizeRole("admin"),
  validateObjectId("id"),
  deleteMessageByAdmin,
);

const multerErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
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

  next(err);
};

router.use(multerErrorHandler);

export default router;
