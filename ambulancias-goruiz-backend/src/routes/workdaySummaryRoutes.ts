import express from "express";
import {
  createWorkdaySummary,
  submitPartialClosure,
  getAllWorkdaySummaries,
  reportIssue,
  getAllIssueReports,
  deleteIssueReport,
  getSummariesCountByStatus,
  markSummaryReviewed,
  getIssuesCount,
  markIssueSeen, // 👈 NUEVO import
} from "../controllers/workdaySummaryController";
import { authenticateToken } from "../middlewares/authMiddleware";
import { authorizeRole } from "../middlewares/roleMiddleware";
import { validateObjectId } from "../middlewares/validateObjectId";

const router = express.Router();

router.post("/", authenticateToken, createWorkdaySummary);
router.post("/partial", authenticateToken, submitPartialClosure);

// 🔵 Contador derivado de resúmenes pendientes
router.get(
  "/count",
  authenticateToken,
  authorizeRole("admin"),
  getSummariesCountByStatus,
);

// 🟠 Contador derivado de averías (por defecto status=open → no vistas)
router.get(
  "/issues/count",
  authenticateToken,
  authorizeRole("admin"),
  getIssuesCount,
);

// 🟠 Marcar avería como vista
router.patch(
  "/issues/:id/seen",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  markIssueSeen,
);

// 🔵 Marcar resumen como revisado
router.patch(
  "/:id/review",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  markSummaryReviewed,
);

router.get("/", authenticateToken, getAllWorkdaySummaries);

// 🟠 Reportar avería: cualquier usuario autenticado (worker durante cierre de jornada)
router.post("/report-issue", authenticateToken, reportIssue);

// 🟠 Listar averías: solo admin (AdminMechanicsPage)
router.get("/issues", authenticateToken, authorizeRole("admin"), getAllIssueReports);
router.delete(
  "/issues/:id",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  deleteIssueReport,
);

export default router;
