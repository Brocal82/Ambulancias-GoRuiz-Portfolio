/**
 * Phase 3.4.3 — PraemienImpactResolution API client.
 *
 * HTTP calls for the 3 admin-only endpoints:
 *   GET  /praemien/impact-resolutions          → listImpactResolutions
 *   GET  /praemien/impact-resolutions/:id      → getImpactResolution
 *   PATCH /praemien/impact-resolutions/:id     → resolveImpactResolution
 *
 * Types mirror the backend DTO — no Mongo internals exposed.
 */
import axios from "../../../api/axios";

export type PraemienResolutionStatus =
  | "pending"
  | "ignored"
  | "adjusted"
  | "blocked"
  | "recalculated";

/** Allowed terminal transitions through the admin API. */
export type ResolvableStatus = "ignored" | "adjusted" | "blocked";

export interface PraemienImpactResolutionDTO {
  id: string;
  status: PraemienResolutionStatus;
  workerId: string;
  workerName?: string;
  year: number;
  month: number;
  beforeValue?: number;
  afterValue?: number;
  delta?: number;
  reason: string;
  note?: string;
  relatedWorkdaySummaryId: string;
  relatedWorkdaySummaryCorrectionId: string;
  relatedMonthlyPraemieId?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListImpactResolutionsParams {
  status?: string;
  workerId?: string;
  year?: number;
  month?: number;
}

export interface ResolveImpactResolutionInput {
  newStatus: ResolvableStatus;
  note: string;
}

export async function listImpactResolutions(
  params?: ListImpactResolutionsParams,
): Promise<PraemienImpactResolutionDTO[]> {
  const res = await axios.get<PraemienImpactResolutionDTO[]>(
    "/praemien/impact-resolutions",
    { params },
  );
  return res.data;
}

export async function getImpactResolution(
  id: string,
): Promise<PraemienImpactResolutionDTO> {
  const res = await axios.get<PraemienImpactResolutionDTO>(
    `/praemien/impact-resolutions/${id}`,
  );
  return res.data;
}

export async function resolveImpactResolution(
  id: string,
  input: ResolveImpactResolutionInput,
): Promise<PraemienImpactResolutionDTO> {
  const res = await axios.patch<PraemienImpactResolutionDTO>(
    `/praemien/impact-resolutions/${id}`,
    input,
  );
  return res.data;
}
