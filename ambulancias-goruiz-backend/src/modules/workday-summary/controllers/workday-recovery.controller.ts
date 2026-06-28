/**
 * Phase 3.2 — Workday Recovery HTTP controllers.
 *
 * GET  /:id/effective   → getEffectiveWorkdaySummary()
 * POST /:id/corrections → createWorkdaySummaryCorrection()
 *
 * Controller responsibility: parse request → call service → return DTO.
 * No business logic here.
 *
 * Auth context (companyId, userId, role) is always derived from the JWT —
 * never from the request body.
 */
import type { Request, Response } from "express";
import { requireCompanyForAdmin } from "../../../utils/requireCompany";
import {
  getEffectiveWorkdaySummary,
  createWorkdaySummaryCorrection,
  OperationalRecoveryError,
} from "../../operational-recovery";
import { voidEmitWorkdayAdminSideEffects } from "../../notifications";
import {
  toEffectiveWorkdaySummaryResponseDTO,
  toWorkdayCorrectionCreatedResponseDTO,
} from "../dto/workday-recovery.dto";

// ── Error handling ────────────────────────────────────────────────────────────

function handleRecoveryError(error: unknown, res: Response, label: string): void {
  if (error instanceof OperationalRecoveryError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }
  console.error(label, error);
  res.status(500).json({ message: "Internal server error" });
}

// ── GET /:id/effective ────────────────────────────────────────────────────────

/**
 * Returns the effective view of a WorkdaySummary.
 * If a correction exists, corrected values are returned alongside the originals.
 * If not, original values are returned.
 */
export const getEffectiveWorkdaySummaryHandler = async (
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
    const effective = await getEffectiveWorkdaySummary({
      workdaySummaryId: id,
      companyId: companyResult.companyId,
    });

    res.status(200).json(toEffectiveWorkdaySummaryResponseDTO(effective));
  } catch (error) {
    handleRecoveryError(error, res, "[WorkdayRecovery] GET effective:");
  }
};

// ── POST /:id/corrections ─────────────────────────────────────────────────────

/**
 * Creates a WorkdaySummaryCorrection for a final WorkdaySummary.
 *
 * Auth context is taken exclusively from the JWT (never from body):
 *   - companyId from req.companyId (set by authenticateToken)
 *   - actorUserId from req.userId (set by authenticateToken)
 *   - actorRole from req.userRole (set by authenticateToken)
 *
 * Body is validated by Zod before reaching this handler (validateBody middleware).
 *
 * On success: emits workday_summary_changed realtime event to company admins.
 */
export const createWorkdaySummaryCorrectionHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  const { id } = req.params;

  // actorUserId and actorRole always come from JWT, never from body.
  const actorUserId = req.userId ?? "";
  const actorRole = req.userRole ?? "";

  try {
    const result = await createWorkdaySummaryCorrection({
      companyId: companyResult.companyId,
      workdaySummaryId: id,
      actorUserId,
      actorRole,
      correctedFinalKm: req.body.correctedFinalKm,
      correctedTotalDienstKm: req.body.correctedTotalDienstKm,
      correctedTotalEffectivePatients: req.body.correctedTotalEffectivePatients,
      correctedTotalRealTrips: req.body.correctedTotalRealTrips,
      correctionReason: req.body.correctionReason,
      correctionNote: req.body.correctionNote,
      praemienImpact: req.body.praemienImpact,
      payrollImpact: req.body.payrollImpact,
    });

    // Emit workday_summary_changed only — OperationalRecoveryEvent already handled by service.
    voidEmitWorkdayAdminSideEffects(companyResult.companyId);

    res.status(201).json(toWorkdayCorrectionCreatedResponseDTO(result));
  } catch (error) {
    handleRecoveryError(error, res, "[WorkdayRecovery] POST correction:");
  }
};
