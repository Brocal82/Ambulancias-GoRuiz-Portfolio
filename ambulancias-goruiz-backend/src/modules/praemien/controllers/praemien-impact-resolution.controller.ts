/**
 * Phase 3.4.2 — PraemienImpactResolution HTTP controllers.
 *
 * GET  /impact-resolutions        → listPraemienImpactResolutions()
 * GET  /impact-resolutions/:id    → getOnePraemienImpactResolution()
 * PATCH /impact-resolutions/:id   → patchPraemienImpactResolution()
 *
 * Controller responsibility: parse request → call service → return DTO.
 * No business logic here.
 *
 * Auth context (companyId, userId, role) is always derived from the JWT.
 * MonthlyPraemie is NEVER mutated here or in the service.
 */
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { requireCompanyForAdmin } from "../../../utils/requireCompany";
import {
  listPraemienImpactResolutions,
  resolvePraemienImpact,
  OperationalRecoveryError,
} from "../../operational-recovery";
import PraemienImpactResolution from "../../operational-recovery/models/praemien-impact-resolution.model";
import { voidEmitPraemienAdminSideEffects } from "../../notifications";
import { toPraemienImpactResolutionDTO } from "../dto/praemien-impact-resolution.dto";
import type { ResolvableStatus } from "../../operational-recovery/types/praemien-impact.types";

// ── Error handling ────────────────────────────────────────────────────────────

function handleRecoveryError(error: unknown, res: Response, label: string): void {
  if (error instanceof OperationalRecoveryError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }
  console.error(label, error);
  res.status(500).json({ message: "Internal server error" });
}

// ── GET /impact-resolutions ───────────────────────────────────────────────────

/**
 * Returns a list of PraemienImpactResolutions for the admin's company.
 *
 * Query params (all optional):
 *   status   — default "pending". Supported values: pending | ignored | adjusted | blocked | recalculated
 *   workerId — filter by worker ObjectId
 *   year     — filter by calendar year
 *   month    — filter by calendar month (1–12)
 */
export const listImpactResolutionsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  try {
    const resolutions = await listPraemienImpactResolutions({
      companyId: companyResult.companyId,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      workerId: typeof req.query.workerId === "string" ? req.query.workerId : undefined,
      year: req.query.year !== undefined ? Number(req.query.year) : undefined,
      month: req.query.month !== undefined ? Number(req.query.month) : undefined,
    });

    res.status(200).json(resolutions.map(toPraemienImpactResolutionDTO));
  } catch (error) {
    handleRecoveryError(error, res, "[PraemienImpact] GET collection:");
  }
};

// ── GET /impact-resolutions/:id ───────────────────────────────────────────────

/**
 * Returns a single PraemienImpactResolution by ID.
 *
 * Returns 404 when not found. Returns 403 when the resolution belongs to a
 * different company than the admin's JWT.
 */
export const getOneImpactResolutionHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  const { id } = req.params;

  try {
    const resolution = await PraemienImpactResolution.findById(id);
    if (!resolution) {
      res.status(404).json({ message: "PraemienImpactResolution not found" });
      return;
    }

    if (String(resolution.companyId) !== companyResult.companyId) {
      res.status(403).json({ message: "PraemienImpactResolution does not belong to your company" });
      return;
    }

    res.status(200).json(toPraemienImpactResolutionDTO(resolution));
  } catch (error) {
    handleRecoveryError(error, res, "[PraemienImpact] GET detail:");
  }
};

// ── PATCH /impact-resolutions/:id ─────────────────────────────────────────────

/**
 * Transitions a PENDING PraemienImpactResolution to a terminal status.
 *
 * Body (validated by Zod before reaching here):
 *   newStatus: "ignored" | "adjusted" | "blocked"
 *   note: string (required)
 *
 * Auth context is taken exclusively from the JWT — never from the request body.
 * After success: emits praemien_changed + admin_counts_changed to company admins.
 */
export const patchImpactResolutionHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  const { id } = req.params;
  const actorUserId = req.userId ?? "";
  const actorRole = req.userRole ?? "";

  // Validate id is a valid ObjectId (middleware already checked format,
  // but guard against non-ObjectId strings that pass isValid)
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: "ID inválido" });
    return;
  }

  try {
    const result = await resolvePraemienImpact({
      companyId: companyResult.companyId,
      resolutionId: id,
      newStatus: req.body.newStatus as ResolvableStatus,
      note: req.body.note,
      actorUserId,
      actorRole,
    });

    voidEmitPraemienAdminSideEffects(companyResult.companyId);

    res.status(200).json(toPraemienImpactResolutionDTO(result.resolution));
  } catch (error) {
    handleRecoveryError(error, res, "[PraemienImpact] PATCH:");
  }
};
