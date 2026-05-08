import { Router } from "express";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { registerToken } from "./controllers/notifications.controller";

const router = Router();

router.post("/register-token", authenticateToken, authorizeRole("worker"), registerToken);

export default router;
