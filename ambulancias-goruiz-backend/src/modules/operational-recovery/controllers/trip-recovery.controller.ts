/**
 * Phase 4.3 — Trip Recovery Admin HTTP controllers.
 */
import type { Request, Response } from "express";
import { requireCompanyForAdmin } from "../../../utils/requireCompany";
import { OperationalRecoveryError } from "../services/operational-recovery.service";
import {
  createTripCorrectionFromApi,
  getEffectiveTripsByWorkdaySummary,
  previewTripCorrectionFromApi,
} from "../services/trip-recovery-api.service";
import type { TripCorrectionBody } from "../schemas/trip-recovery.schema";
import {
  toEffectiveTripsListResponseDTO,
  toTripCorrectionCreatedResponseDTO,
  toTripCorrectionPreviewResponseDTO,
} from "../dto/trip-recovery.dto";

function handleRecoveryError(error: unknown, res: Response, label: string): void {
  if (error instanceof OperationalRecoveryError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }
  console.error(label, error);
  res.status(500).json({ message: "Internal server error" });
}

function getAuthContext(req: Request) {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    return { ok: false as const, companyResult };
  }
  return {
    ok: true as const,
    auth: {
      companyId: companyResult.companyId,
      actorUserId: req.userId ?? "",
      actorRole: req.userRole ?? "",
    },
  };
}

export const previewTripCorrectionHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const ctx = getAuthContext(req);
  if (!ctx.ok) {
    res.status(ctx.companyResult.statusCode).json({ message: ctx.companyResult.message });
    return;
  }

  try {
    const result = await previewTripCorrectionFromApi(
      req.body as TripCorrectionBody,
      ctx.auth,
    );
    res.status(200).json(toTripCorrectionPreviewResponseDTO(result));
  } catch (error) {
    handleRecoveryError(error, res, "[TripRecovery] POST preview:");
  }
};

export const createTripCorrectionHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const ctx = getAuthContext(req);
  if (!ctx.ok) {
    res.status(ctx.companyResult.statusCode).json({ message: ctx.companyResult.message });
    return;
  }

  try {
    const preview = await previewTripCorrectionFromApi(
      req.body as TripCorrectionBody,
      ctx.auth,
    );
    const result = await createTripCorrectionFromApi(
      req.body as TripCorrectionBody,
      ctx.auth,
    );

    res.status(201).json(
      toTripCorrectionCreatedResponseDTO(result, preview.workdayProjection.before, preview.workdayProjection.after),
    );
  } catch (error) {
    handleRecoveryError(error, res, "[TripRecovery] POST create:");
  }
};

export const getEffectiveTripsByWorkdaySummaryHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const ctx = getAuthContext(req);
  if (!ctx.ok) {
    res.status(ctx.companyResult.statusCode).json({ message: ctx.companyResult.message });
    return;
  }

  const { workdaySummaryId } = req.params;

  try {
    const result = await getEffectiveTripsByWorkdaySummary(
      workdaySummaryId,
      ctx.auth.companyId,
    );
    res.status(200).json(toEffectiveTripsListResponseDTO(result));
  } catch (error) {
    handleRecoveryError(error, res, "[TripRecovery] GET effective-trips:");
  }
};
