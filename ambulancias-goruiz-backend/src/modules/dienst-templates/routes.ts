// backend/src/modules/dienst-templates/routes.ts
// FASE 1: router de compatibilidad para CRUD de plantillas sin cambiar la API publica.

import express from "express";

import {
  getDienstTemplates,
  createDienstTemplate,
  updateDienstTemplate,
  deleteDienstTemplate,
} from "./controllers";

import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";

const router = express.Router();

router.get("/", authenticateToken, authorizeRole("admin"), getDienstTemplates);
router.post("/", authenticateToken, authorizeRole("admin"), createDienstTemplate);
router.put("/:id", authenticateToken, authorizeRole("admin"), updateDienstTemplate);
router.delete("/:id", authenticateToken, authorizeRole("admin"), deleteDienstTemplate);

export default router;
