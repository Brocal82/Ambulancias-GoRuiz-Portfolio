//backend/src/routes/teamRoutes.ts
import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware";
import { authorizeRole } from "../middlewares/roleMiddleware";
import {
  listTeams,
  createTeam,
  deleteTeam,
  getUsedTeamsForWeek,
  updateTeam,
} from "../controllers/teamController";

const router = Router();

// 🔐 Todas las rutas requieren admin y token
router.use(authenticateToken, authorizeRole("admin"));

// 📌 Obtener todos los equipos
router.get("/", listTeams);

// ✅ NUEVA RUTA: equipos usados en una semana específica
router.get("/used-for-week", getUsedTeamsForWeek);

// ➕ Crear equipo
router.post("/", createTeam);

// ✏️ Actualizar equipo
router.patch("/:id", updateTeam);

// ❌ Eliminar equipo
router.delete("/:id", deleteTeam);

export default router;
