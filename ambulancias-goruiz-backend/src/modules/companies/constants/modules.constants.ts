/**
 * Canonical module keys for per-company feature gating.
 * These strings are stored in Company.enabledModules.
 *
 * ALWAYS-ON INFRASTRUCTURE (not module keys — never gated):
 *   users, companies, invitations
 *
 * COMPOSITE MODULES (one key covers multiple backend/frontend folders):
 *   scheduling  → diensts + dienst-templates (templates mounted as subroute)
 *   workday     → workday-summary + trips (jornada / viajes)
 *   mechanics   → averías / report-issue + admin mechanics (opcional por empresa)
 *
 * V1 OPERATIONAL (superadmin UI):
 *   `scheduling` remains locked-on until Phase 4 prerequisites are met.
 *   `workday` (jornada + viajes) is toggleable per company; `praemien`
 *   cannot be enabled without `workday` (validated in companies.service).
 */

export const MODULE_KEYS = {
  HOSPITALS:    "hospitals",
  AMBULANCES:   "ambulances",
  TEAMS:        "teams",
  SCHEDULING:   "scheduling",
  WORKDAY:      "workday",
  MECHANICS:    "mechanics",
  APPOINTMENTS: "appointments",
  MESSAGES:     "messages",
  VACATION:     "vacation",
  SICK_LEAVES:  "sick-leaves",
  PRAEMIEN:     "praemien",
  PAYROLL:      "payroll",
  DOCUMENTS:    "documents",
} as const;

export type ModuleKey = (typeof MODULE_KEYS)[keyof typeof MODULE_KEYS];

/**
 * Full default set: all canonical V1 modules.
 * Used by the backfill script and new company creation defaults.
 * Existing companies with an empty enabledModules array must be migrated
 * to this list before any requireModule() guard is activated on a route.
 */
export const V1_DEFAULT_MODULES: ModuleKey[] = Object.values(MODULE_KEYS);
