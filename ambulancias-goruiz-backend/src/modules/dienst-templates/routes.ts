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
import { requireModule } from "../../middlewares/requireModule";
import { validateObjectId } from "../../middlewares/validateObjectId";
import { MODULE_KEYS } from "../companies/constants/modules.constants";

const router = express.Router();

router.get(
  "/",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  authorizeRole("admin"),
  getDienstTemplates,
);
router.post(
  "/",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  authorizeRole("admin"),
  createDienstTemplate,
);
router.put(
  "/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  authorizeRole("admin"),
  validateObjectId("id"),
  updateDienstTemplate,
);
router.delete(
  "/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  authorizeRole("admin"),
  validateObjectId("id"),
  deleteDienstTemplate,
);

export default router;
