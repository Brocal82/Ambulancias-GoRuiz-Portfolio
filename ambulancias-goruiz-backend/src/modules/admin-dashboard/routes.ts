import { Router } from "express";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { getAdminDashboardCountsHandler } from "./controllers/admin-dashboard.controller";

const router = Router();

router.get(
  "/dashboard-counts",
  authenticateToken,
  authorizeRole("admin"),
  getAdminDashboardCountsHandler,
);

export default router;
