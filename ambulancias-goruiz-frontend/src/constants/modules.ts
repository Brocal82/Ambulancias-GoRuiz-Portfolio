/**
 * Canonical module keys for per-company feature gating.
 * Must stay in sync with the backend:
 *   ambulancias-goruiz-backend/src/modules/companies/constants/modules.constants.ts
 *
 * ALWAYS-ON INFRASTRUCTURE (not in this list — never gated):
 *   users, companies, invitations
 *
 * COMPOSITE MODULES:
 *   scheduling     → diensts + dienst-templates
 *   excel-planning → planificación importada Excel (/api/excel-planning), aparte de scheduling
 *   workday     → workday-summary + trips
 *   mechanics   → averías (report-issue, admin mechanics)
 *
 * Superadmin: todos los módulos de la lista son opt-in/opt-out por empresa.
 * (Antes `scheduling` estaba bloqueado; ahora se puede desacoplar la dienst
 * dinámica con vistas a un flujo Excel de solo lectura en el futuro.)
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
  EXCEL_PLANNING: "excel-planning",
} as const;

export type ModuleKey = (typeof MODULE_KEYS)[keyof typeof MODULE_KEYS];

/** All canonical V1 module keys in display order. */
export const ALL_MODULE_KEYS: ModuleKey[] = [
  MODULE_KEYS.HOSPITALS,
  MODULE_KEYS.AMBULANCES,
  MODULE_KEYS.TEAMS,
  MODULE_KEYS.SCHEDULING,
  MODULE_KEYS.WORKDAY,
  MODULE_KEYS.MECHANICS,
  MODULE_KEYS.APPOINTMENTS,
  MODULE_KEYS.MESSAGES,
  MODULE_KEYS.VACATION,
  MODULE_KEYS.SICK_LEAVES,
  MODULE_KEYS.PRAEMIEN,
  MODULE_KEYS.PAYROLL,
  MODULE_KEYS.DOCUMENTS,
  MODULE_KEYS.EXCEL_PLANNING,
];

/** Human-readable labels for superadmin UI. */
/** Icons for superadmin module UI (display only). */
export const MODULE_ICONS: Record<ModuleKey, string> = {
  hospitals: "🏥",
  ambulances: "🚑",
  teams: "👥",
  scheduling: "🗓️",
  workday: "🚨",
  mechanics: "🔧",
  appointments: "📕",
  messages: "📨",
  vacation: "🏖️",
  "sick-leaves": "🤒",
  praemien: "🎖",
  payroll: "🛠",
  documents: "📄",
  [MODULE_KEYS.EXCEL_PLANNING]: "📊",
};

/** Display groups for read-only module overview (superadmin detail). */
export const MODULE_DISPLAY_GROUPS: ReadonlyArray<{
  id: "foundation" | "planning" | "people" | "comms";
  keys: readonly ModuleKey[];
}> = [
  {
    id: "foundation",
    keys: [MODULE_KEYS.HOSPITALS, MODULE_KEYS.AMBULANCES, MODULE_KEYS.TEAMS],
  },
  {
    id: "planning",
    keys: [
      MODULE_KEYS.SCHEDULING,
      MODULE_KEYS.EXCEL_PLANNING,
      MODULE_KEYS.WORKDAY,
      MODULE_KEYS.MECHANICS,
    ],
  },
  {
    id: "people",
    keys: [
      MODULE_KEYS.VACATION,
      MODULE_KEYS.SICK_LEAVES,
      MODULE_KEYS.PRAEMIEN,
      MODULE_KEYS.PAYROLL,
      MODULE_KEYS.DOCUMENTS,
    ],
  },
  {
    id: "comms",
    keys: [MODULE_KEYS.APPOINTMENTS, MODULE_KEYS.MESSAGES],
  },
];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  hospitals:    "Hospitales",
  ambulances:   "Ambulancias",
  teams:        "Equipos",
  scheduling:   "Planificación (Diensts)",
  workday:      "Jornada laboral y viajes",
  mechanics:    "Averías / taller",
  appointments: "Citas con jefe",
  messages:     "Mensajes internos",
  vacation:     "Vacaciones",
  "sick-leaves":"Bajas por enfermedad",
  praemien:     "Prämien (bonificaciones)",
  payroll:      "Nóminas",
  documents:    "Documentos de empresa",
  [MODULE_KEYS.EXCEL_PLANNING]: "Planificación (Excel)",
};

/**
 * Módulos que el superadmin no puede desactivar. Vacío: todo es configurable
 * (la planificación Dienst dinámica es el módulo `scheduling`).
 */
export const V1_LOCKED_ON_MODULES: ReadonlySet<ModuleKey> = new Set();
