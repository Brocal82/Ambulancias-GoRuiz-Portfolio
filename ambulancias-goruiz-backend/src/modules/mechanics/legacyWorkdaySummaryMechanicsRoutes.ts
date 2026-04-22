/**
 * Compatibilidad producción: clientes que aún usan /api/workday-summary/report-issue|issues*.
 * Misma pila de middlewares y handlers que /api/mechanics. Cabeceras Deprecation + Link.
 * Plan: retirar tras ventana de migración (monitorizar 404 en estas rutas).
 */
import express from "express";
import { registerMechanicsIssueRoutes } from "./registerMechanicsIssueRoutes";

const router = express.Router();
registerMechanicsIssueRoutes(router, { deprecate: true });
export default router;
