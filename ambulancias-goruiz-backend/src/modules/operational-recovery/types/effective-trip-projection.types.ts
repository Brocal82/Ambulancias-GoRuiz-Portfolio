/**
 * Phase 4.2 — Effective trip aggregate projection types.
 */
import type { PraemienRuleConfig } from "../../praemien/types/praemien-rule-config";

/** Minimal effective trip shape for aggregate projection. */
export interface ProjectableEffectiveTrip {
  countsTrip: 0 | 1;
  wasCancelled: boolean;
  cancelledAtPickup?: boolean;
  kmStart?: number;
  kmEnd?: number;
  timePickup?: string;
  isEffectivelyVoided?: boolean;
  isIncludedInEffectiveCount?: boolean;
}

export interface EffectiveTripProjectionContext {
  date: string;
  dienstStartTime?: string | null;
  praemienRulesSnapshot?: PraemienRuleConfig;
  /** Original WorkdaySummary baseline for km derivation. */
  baselineFinalKm?: number;
  baselineTotalDienstKm: number;
  /** Sum of per-trip km from original (uncorrected) trips in the workday. */
  baselineTripKmTotal: number;
}

export interface EffectiveTripProjectionResult {
  totalRealTrips: number;
  totalEffectivePatients: number;
  totalDienstKm: number;
  finalKm?: number;
  /** Sum of per-trip km from effective trips (non-voided). */
  tripKmTotal: number;
  /** Delta vs baselineTripKmTotal. */
  tripKmDelta: number;
}
