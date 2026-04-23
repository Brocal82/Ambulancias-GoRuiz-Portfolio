/**
 * Canonical module keys for per-company feature gating.
 * These strings are stored in Company.enabledModules.
 *
 * ALWAYS-ON INFRASTRUCTURE (not module keys — never gated):
 *   users, companies, invitations
 *
 * COMPOSITE MODULES (one key covers multiple backend/frontend folders):
 *   scheduling  → diensts + dienst-templates (CRUD bajo /api/diensts/templates/…).
 *   excel-planning → import/publicación semanal Excel (solo lectura), /api/excel-planning;
 *     independiente de `scheduling`; puede desactivarse por separado.
 *   workday     → workday-summary + trips (jornada / viajes)
 *   mechanics   → averías / report-issue + admin mechanics (opcional por empresa)
 *
 * Superadmin: `scheduling` (diensts + plantillas) es opt-in por empresa.
 * Prämien automático requiere `workday`; manual puede ir sin jornada digital.
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
  /** Planificación semanal importada desde Excel (solo lectura; independiente de Diensts). */
  EXCEL_PLANNING: "excel-planning",
} as const;

export type ModuleKey = (typeof MODULE_KEYS)[keyof typeof MODULE_KEYS];

/**
 * Full default set: all canonical V1 modules.
 * Used by the backfill script and new company creation defaults.
 * Existing companies with an empty enabledModules array must be migrated
 * to this list before any requireModule() guard is activated on a route.
 */
export const V1_DEFAULT_MODULES: ModuleKey[] = Object.values(MODULE_KEYS);
