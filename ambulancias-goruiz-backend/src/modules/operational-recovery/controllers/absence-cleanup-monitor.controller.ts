/**
 * Phase 2.3 — Absence Cleanup Monitor: HTTP controller.
 *
 * No business logic — delegates entirely to the detection and repair services.
 * Multi-tenant: companyId extracted via requireCompanyForAdmin.
 */
import type { Request, Response } from "express";
import { requireCompanyForAdmin } from "../../../utils/requireCompany";
import { detectAbsenceInconsistencies } from "../services/absence-cleanup-detection.service";
import { repairAbsenceInconsistency } from "../services/absence-cleanup-repair.service";
import {
  scanAbsenceCleanupQuerySchema,
  repairAbsenceCleanupSchema,
} from "../schemas/absence-cleanup-monitor.schema";
import type { AbsenceType } from "../types/absence-cleanup.types";

/**
 * GET /api/operational-recovery/absence-cleanup
 * Scans for stale Dienst assignments. Read-only.
 */
export async function scanInconsistencies(
  req: Request,
  res: Response,
): Promise<void> {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res
      .status(companyResult.statusCode)
      .json({ message: companyResult.message });
    return;
  }

  const queryParsed = scanAbsenceCleanupQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    res.status(400).json({ message: "Parámetros de consulta inválidos" });
    return;
  }

  const { fromDate, toDate } = queryParsed.data;

  const inconsistencies = await detectAbsenceInconsistencies({
    companyId: companyResult.companyId,
    fromDate,
    toDate,
  });

  res.status(200).json({ inconsistencies, scannedAt: new Date().toISOString() });
}

/**
 * POST /api/operational-recovery/absence-cleanup/repair
 * Repairs selected stale assignments. Admin only.
 */
export async function repairInconsistencies(
  req: Request,
  res: Response,
): Promise<void> {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res
      .status(companyResult.statusCode)
      .json({ message: companyResult.message });
    return;
  }

  const bodyParsed = repairAbsenceCleanupSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ message: "Cuerpo de petición inválido" });
    return;
  }

  const { items } = bodyParsed.data;
  const actorUserId = req.userId as string;
  const actorRole = req.userRole as string;

  const results = await Promise.all(
    items.map((item) =>
      repairAbsenceInconsistency({
        companyId: companyResult.companyId,
        workerId: item.workerId,
        absenceType: item.absenceType as AbsenceType,
        absenceId: item.absenceId,
        actorUserId,
        actorRole,
      }),
    ),
  );

  res.status(200).json({ results });
}
