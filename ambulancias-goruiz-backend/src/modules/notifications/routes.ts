import { Router } from "express";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { registerToken, getHistory } from "./controllers/notifications.controller";

const router = Router();

router.post("/register-token", authenticateToken, authorizeRole("worker"), registerToken);
router.get("/history", authenticateToken, authorizeRole("worker"), getHistory);

export default router;
