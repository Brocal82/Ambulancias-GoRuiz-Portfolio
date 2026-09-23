import { MODULE_KEYS, type CompanyModuleKey } from "../types/auth";

export type WorkerTabKey =
  | "home"
  | "workday"
  | "agenda"
  | "vacations"
  | "sickLeaves"
  | "appointments"
  | "praemien"
  | "documents"
  | "messages"
  | "profile";

export type PushNavigationTarget = {
  tab: WorkerTabKey;
  agendaDate?: string;
};

function hasAgendaModule(enabledModules: CompanyModuleKey[]): boolean {
  return (
    enabledModules.includes(MODULE_KEYS.SCHEDULING) ||
    enabledModules.includes(MODULE_KEYS.EXCEL_PLANNING)
  );
}

function hasDocumentsModule(enabledModules: CompanyModuleKey[]): boolean {
  return (
    enabledModules.includes(MODULE_KEYS.DOCUMENTS) ||
    enabledModules.includes(MODULE_KEYS.PAYROLL)
  );
}

/** Resolves push payload to a tab only when the target module is enabled. */
export function resolvePushNavigationTarget(
  data: Record<string, unknown> | null | undefined,
  enabledModules: CompanyModuleKey[],
): PushNavigationTarget | null {
  if (!data || typeof data.screen !== "string") return null;

  const screen = data.screen;

  if (screen === "messages" && !enabledModules.includes(MODULE_KEYS.MESSAGES)) {
    return null;
  }
  if (screen === "agenda" && !hasAgendaModule(enabledModules)) {
    return null;
  }
  if (screen === "vacations" && !enabledModules.includes(MODULE_KEYS.VACATION)) {
    return null;
  }
  if (screen === "sickLeaves" && !enabledModules.includes(MODULE_KEYS.SICK_LEAVES)) {
    return null;
  }
  if (screen === "appointments" && !enabledModules.includes(MODULE_KEYS.APPOINTMENTS)) {
    return null;
  }
  if (screen === "praemien" && !enabledModules.includes(MODULE_KEYS.PRAEMIEN)) {
    return null;
  }
  if (screen === "documents" && !hasDocumentsModule(enabledModules)) {
    return null;
  }
  if (screen === "workday" && !enabledModules.includes(MODULE_KEYS.WORKDAY)) {
    return null;
  }

  if (screen === "agenda") {
    const date = typeof data.date === "string" ? data.date : undefined;
    return { tab: "agenda", agendaDate: date };
  }

  const tabMap: Record<string, WorkerTabKey> = {
    messages: "messages",
    vacations: "vacations",
    sickLeaves: "sickLeaves",
    appointments: "appointments",
    praemien: "praemien",
    documents: "documents",
    workday: "workday",
  };

  const tab = tabMap[screen];
  return tab ? { tab } : null;
}

/** Maps a push payload to WS refresh triggers (foreground delivery). */
export function pushRefreshTabFromData(
  data: Record<string, unknown> | null | undefined,
  enabledModules: CompanyModuleKey[],
): WorkerTabKey | null {
  const target = resolvePushNavigationTarget(data, enabledModules);
  return target?.tab ?? null;
}
