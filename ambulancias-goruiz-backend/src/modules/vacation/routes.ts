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
  removeMyDeniedVacationRequest,
} from "./index";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { requireModule } from "../../middlewares/requireModule";
import { MODULE_KEYS } from "../companies/constants/modules.constants";
import { validateBody } from "../../middlewares/validateBody";
import { validateObjectId } from "../../middlewares/validateObjectId";
import {
  createVacationRequestSchema,
  checkVacationsInRangeSchema,
  upsertMonthConfigSchema,
  updateVacationRequestSchema,
} from "./schemas/vacation.schemas";

const router = Router();

router.get("/availability", authenticateToken, requireModule(MODULE_KEYS.VACATION), getAvailability);

router.post(
  "/check-range",
  authenticateToken,
  requireModule(MODULE_KEYS.VACATION),
  validateBody(checkVacationsInRangeSchema),
  checkVacationsInRange,
);

router.get(
  "/month-config",
  authenticateToken,
  requireModule(MODULE_KEYS.VACATION),
  authorizeRole("admin"),
  getMonthConfig,
);
router.post(
  "/month-config",
  authenticateToken,
  requireModule(MODULE_KEYS.VACATION),
  authorizeRole("admin"),
  validateBody(upsertMonthConfigSchema),
  upsertMonthConfig,
);

router.post(
  "/",
  authenticateToken,
  requireModule(MODULE_KEYS.VACATION),
  authorizeRole("worker"),
  validateBody(createVacationRequestSchema),
  createVacationRequest,
);

router.patch(
  "/:id/cancel",
  authenticateToken,
  requireModule(MODULE_KEYS.VACATION),
  authorizeRole("worker"),
  validateObjectId("id"),
  cancelMyVacationRequest,
);

router.get(
  "/",
  authenticateToken,
  requireModule(MODULE_KEYS.VACATION),
  authorizeRole("admin"),
  getVacationRequests,
);

router.get(
  "/count",
  authenticateToken,
  requireModule(MODULE_KEYS.VACATION),
  authorizeRole("admin"),
  getVacationPendingCount,
);

router.patch(
  "/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.VACATION),
  authorizeRole("admin"),
  validateObjectId("id"),
  validateBody(updateVacationRequestSchema),
  updateVacationRequest,
);

router.post(
  "/:id/respond",
  authenticateToken,
  requireModule(MODULE_KEYS.VACATION),
  authorizeRole("worker"),
  validateObjectId("id"),
  respondToAlternativeDate,
);

router.get(
  "/user",
  authenticateToken,
  requireModule(MODULE_KEYS.VACATION),
  authorizeRole("worker"),
  getUserVacationRequests,
);

router.delete(
  "/:id/mine",
  authenticateToken,
  requireModule(MODULE_KEYS.VACATION),
  authorizeRole("worker"),
  validateObjectId("id"),
  removeMyDeniedVacationRequest,
);

router.delete(
  "/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.VACATION),
  authorizeRole("admin"),
  validateObjectId("id"),
  deleteVacationRequest,
);

export default router;
