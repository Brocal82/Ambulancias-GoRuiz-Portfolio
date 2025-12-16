import { Router } from "express";
import {
  getNotifications,
  postNotification,
  patchNotificationRead,
} from "../controllers/notificationController";
import { authenticateToken } from "../middlewares/authMiddleware";

const router = Router();

// GET /api/notifications?userId=...&role=worker&unreadOnly=true&page=1&limit=10&type=message
router.get("/notifications", authenticateToken, getNotifications);

// POST /api/notifications
router.post("/notifications", authenticateToken, postNotification);

// PATCH /api/notifications/:id/read
router.patch(
  "/notifications/:id/read",
  authenticateToken,
  patchNotificationRead,
);

export default router;
