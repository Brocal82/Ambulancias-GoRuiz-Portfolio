import { Router } from "express";
import {
  getUserVacationRequests,
  getVacationRequests,
  createVacationRequest,
  cancelMyVacationRequest,
  updateVacationRequest,
  respondToAlternativeDate,
  deleteVacationRequest,
  getVacationPendingCount,
  getAvailability,
  getMonthConfig,
  upsertMonthConfig,
  checkVacationsInRange,
} from "../../controllers/vacationController";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";

const router = Router();

router.get("/availability", authenticateToken, getAvailability);

router.post("/check-range", authenticateToken, checkVacationsInRange);

router.get(
  "/month-config",
  authenticateToken,
  authorizeRole("admin"),
  getMonthConfig,
);
router.post(
  "/month-config",
  authenticateToken,
  authorizeRole("admin"),
  upsertMonthConfig,
);

router.post("/", authenticateToken, createVacationRequest);

router.patch("/:id/cancel", authenticateToken, cancelMyVacationRequest);

router.get("/", authenticateToken, authorizeRole("admin"), getVacationRequests);

router.get(
  "/count",
  authenticateToken,
  authorizeRole("admin"),
  getVacationPendingCount,
);

router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  updateVacationRequest,
);

router.post("/:id/respond", authenticateToken, respondToAlternativeDate);

router.get("/user", authenticateToken, getUserVacationRequests);

router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  deleteVacationRequest,
);

export default router;
