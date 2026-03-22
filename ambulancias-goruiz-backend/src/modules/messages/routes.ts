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
import { upload } from "../../middlewares/uploadMiddleware";
import { validateObjectId } from "../../middlewares/validateObjectId";
import type { ErrorRequestHandler } from "express";

const router = Router();

router.post(
  "/",
  authenticateToken,
  authorizeRole("admin"),
  upload.array("attachment", 5),
  createMessage,
);

router.get("/", authenticateToken, authorizeRole("worker"), getMyMessages);

router.get("/sent", authenticateToken, authorizeRole("admin"), getSentMessages);

router.get(
  "/user/:id",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  getMessagesForUserAsAdmin,
);

router.patch(
  "/:id/read",
  authenticateToken,
  authorizeRole("worker"),
  validateObjectId("id"),
  markMessageAsRead,
);

router.patch(
  "/:id/remove",
  authenticateToken,
  authorizeRole("worker"),
  validateObjectId("id"),
  deleteMessageForUser,
);

router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  deleteMessageByAdmin,
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
