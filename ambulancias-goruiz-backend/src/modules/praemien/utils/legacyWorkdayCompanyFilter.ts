import mongoose from "mongoose";

/**
 * WorkdaySummary tenant filter for Praemien manual helpers.
 *
 * Legacy records may have `companyId: null`. Callers MUST always combine this
 * with driver/medic userId scoping so null rows cannot leak across tenants.
 * See `docs/POLICY-multi-tenant-legacy-companyId.md`.
 */
export function legacyAwareWorkdayCompanyFilter(
  companyObjectId: mongoose.Types.ObjectId,
): {
  $or: [{ companyId: mongoose.Types.ObjectId }, { companyId: null }];
} {
  return {
    $or: [{ companyId: companyObjectId }, { companyId: null }],
  };
}

/** Automatic Praemien aggregates only final workday closures (never partials). */
export const AUTOMATIC_PRAEMIEN_FINAL_CLOSURE_FILTER = {
  isFinalClosure: true,
} as const;
