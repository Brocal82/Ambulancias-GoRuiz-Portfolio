// src/modules/teams/routes.ts
import { Router } from "express";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { requireModule } from "../../middlewares/requireModule";
import { MODULE_KEYS } from "../companies/constants/modules.constants";
import { validateBody } from "../../middlewares/validateBody";
import { validateObjectId } from "../../middlewares/validateObjectId";
import {
  listTeams,
  createTeam,
  deleteTeam,
  getUsedTeamsForWeek,
  updateTeam,
} from "./controllers/teams.controller";
import { createTeamSchema, updateTeamSchema } from "./schemas/team.schema";

const router = Router();

// 🔐 Token, módulo teams, rol admin
router.use(authenticateToken, requireModule(MODULE_KEYS.TEAMS), authorizeRole("admin"));

router.get("/", listTeams);
router.get("/used-for-week", getUsedTeamsForWeek);
router.post("/", validateBody(createTeamSchema), createTeam);
router.patch("/:id", validateObjectId("id"), validateBody(updateTeamSchema), updateTeam);
router.delete("/:id", validateObjectId("id"), deleteTeam);

export default router;
