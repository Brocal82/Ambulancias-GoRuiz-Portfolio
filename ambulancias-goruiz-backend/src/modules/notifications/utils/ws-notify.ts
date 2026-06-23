import mongoose from "mongoose";
import User from "../../users/models/user.model";
import { notifyUsers } from "../ws-manager";
import { filterPushRecipients } from "./push-recipients";
import { WS_EVENTS } from "../constants/ws-events";
import { MODULE_KEYS, type ModuleKey } from "../../companies/constants/modules.constants";

function normalizeUserId(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") {
    const s = value.trim();
    return s !== "" ? s : undefined;
  }
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (typeof value === "object" && "_id" in value) {
    const id = (value as { _id: unknown })._id;
    return id != null ? String(id) : undefined;
  }
  const s = String(value).trim();
  return s !== "" ? s : undefined;
}

/** Collect driver/medic ids from assignment rows (old ∪ new unions). */
export function collectWorkerIdsFromAssignments(
  assignments: Array<{ driver?: unknown; medic?: unknown }> | undefined,
): Set<string> {
  const ids = new Set<string>();
  for (const row of assignments ?? []) {
    const driverId = normalizeUserId(row.driver);
    const medicId = normalizeUserId(row.medic);
    if (driverId) ids.add(driverId);
    if (medicId) ids.add(medicId);
  }
  return ids;
}

export async function notifyUsersModuleGated(
  userIds: Iterable<string>,
  event: string,
  moduleKey: ModuleKey,
  actingCompanyId: string,
): Promise<void> {
  const unique = [...new Set([...userIds].map((id) => String(id).trim()).filter(Boolean))];
  if (unique.length === 0) return;

  const filtered = await filterPushRecipients(unique, {
    moduleKey,
    actingCompanyId,
  });
  if (filtered.length === 0) return;
  notifyUsers(filtered, event);
}

export async function notifyCompanyAdminsModuleGated(
  companyId: string,
  event: string,
  moduleKey: ModuleKey,
): Promise<void> {
  const companyOid = new mongoose.Types.ObjectId(companyId);
  const admins = await User.find({ role: "admin", companyId: companyOid })
    .select("_id")
    .lean();
  const adminIds = admins.map((admin) => String(admin._id));
  await notifyUsersModuleGated(adminIds, event, moduleKey, companyId);
}

/** Admins: planning refresh. Workers: agenda refresh. One emit pair per mutation. */
export function voidEmitSchedulingMutationRealtime(
  companyId: string,
  affectedWorkerIds: Iterable<string>,
): void {
  void (async () => {
    try {
      await notifyCompanyAdminsModuleGated(
        companyId,
        WS_EVENTS.DIENST_CHANGED,
        MODULE_KEYS.SCHEDULING,
      );
      const workers = [...new Set([...affectedWorkerIds].map((id) => String(id).trim()).filter(Boolean))];
      if (workers.length === 0) return;
      await notifyUsersModuleGated(
        workers,
        WS_EVENTS.AGENDA_CHANGED,
        MODULE_KEYS.SCHEDULING,
        companyId,
      );
    } catch (err) {
      console.error("[ws-notify] voidEmitSchedulingMutationRealtime failed:", err);
    }
  })();
}

export function voidEmitDienstPlanningChanged(companyId: string): void {
  void notifyCompanyAdminsModuleGated(
    companyId,
    WS_EVENTS.DIENST_CHANGED,
    MODULE_KEYS.SCHEDULING,
  );
}

/** Worker closure → admin summaries + dashboard counters. */
export function voidEmitWorkdayAdminSideEffects(companyId: string): void {
  void (async () => {
    await notifyCompanyAdminsModuleGated(
      companyId,
      WS_EVENTS.WORKDAY_SUMMARY_CHANGED,
      MODULE_KEYS.WORKDAY,
    );
    await notifyCompanyAdminsModuleGated(
      companyId,
      WS_EVENTS.ADMIN_COUNTS_CHANGED,
      MODULE_KEYS.WORKDAY,
    );
  })();
}

/** Admin review → worker workday state refresh. */
export function voidEmitWorkdayWorkerRefresh(
  workerIds: Iterable<string>,
  companyId: string,
): void {
  void notifyUsersModuleGated(
    [...workerIds],
    WS_EVENTS.WORKDAY_SUMMARY_CHANGED,
    MODULE_KEYS.WORKDAY,
    companyId,
  );
}

const MECHANICS_WS_ROLES = ["admin", "jefe_mecanicos", "mecanico"] as const;

/** Mechanics issue mutations → admin / jefe_mecanicos / mecanico dashboards. */
export function voidEmitMechanicsChanged(companyId: string): void {
  void (async () => {
    try {
      const companyOid = new mongoose.Types.ObjectId(companyId);
      const users = await User.find({
        companyId: companyOid,
        role: { $in: [...MECHANICS_WS_ROLES] },
      })
        .select("_id")
        .lean();
      const ids = users.map((user) => String(user._id));
      await notifyUsersModuleGated(
        ids,
        WS_EVENTS.MECHANICS_CHANGED,
        MODULE_KEYS.MECHANICS,
        companyId,
      );
    } catch (err) {
      console.error("[ws-notify] voidEmitMechanicsChanged failed:", err);
    }
  })();
}

/** Worker manual submit / admin queue refresh + dashboard counters. */
export function voidEmitPraemienAdminSideEffects(companyId: string): void {
  void (async () => {
    try {
      await notifyCompanyAdminsModuleGated(
        companyId,
        WS_EVENTS.PRAEMIEN_CHANGED,
        MODULE_KEYS.PRAEMIEN,
      );
      await notifyCompanyAdminsModuleGated(
        companyId,
        WS_EVENTS.ADMIN_COUNTS_CHANGED,
        MODULE_KEYS.PRAEMIEN,
      );
    } catch (err) {
      console.error("[ws-notify] voidEmitPraemienAdminSideEffects failed:", err);
    }
  })();
}

/** Admin review / save-monthly → worker Prämien page refresh. */
export function voidEmitPraemienWorkerRefresh(
  workerIds: Iterable<string>,
  companyId: string,
): void {
  void notifyUsersModuleGated(
    [...workerIds],
    WS_EVENTS.PRAEMIEN_CHANGED,
    MODULE_KEYS.PRAEMIEN,
    companyId,
  );
}

/** Admin rule update -> same-company admins/workers refetch Praemien state. */
export function voidEmitPraemienRulesChanged(companyId: string): void {
  void (async () => {
    try {
      const companyOid = new mongoose.Types.ObjectId(companyId);
      const users = await User.find({
        companyId: companyOid,
        role: { $in: ["admin", "worker"] },
      })
        .select("_id")
        .lean();
      const ids = users.map((user) => String(user._id));
      await notifyUsersModuleGated(
        ids,
        WS_EVENTS.PRAEMIEN_CHANGED,
        MODULE_KEYS.PRAEMIEN,
        companyId,
      );
    } catch (err) {
      console.error("[ws-notify] voidEmitPraemienRulesChanged failed:", err);
    }
  })();
}

async function collectSameCompanyUserIds(companyId: string): Promise<string[]> {
  const companyOid = new mongoose.Types.ObjectId(companyId);
  const users = await User.find({ companyId: companyOid }).select("_id").lean();
  return users.map((user) => String(user._id));
}

/** Company-level session config changed → all same-company connected users. */
export function voidEmitCompanyChanged(companyId: string): void {
  void (async () => {
    try {
      const ids = await collectSameCompanyUserIds(companyId);
      notifyUsers(ids, WS_EVENTS.COMPANY_CHANGED);
    } catch (err) {
      console.error("[ws-notify] voidEmitCompanyChanged failed:", err);
    }
  })();
}

/** enabledModules changed → all same-company connected users. */
export function voidEmitModulesChanged(companyId: string): void {
  void (async () => {
    try {
      const ids = await collectSameCompanyUserIds(companyId);
      notifyUsers(ids, WS_EVENTS.MODULES_CHANGED);
    } catch (err) {
      console.error("[ws-notify] voidEmitModulesChanged failed:", err);
    }
  })();
}

/** User account/profile/status changed → targeted user sessions. */
export function voidEmitAccountChanged(userIds: Iterable<string>): void {
  const unique = [...new Set([...userIds].map((id) => String(id).trim()).filter(Boolean))];
  if (unique.length === 0) return;
  notifyUsers(unique, WS_EVENTS.ACCOUNT_CHANGED);
}

/** Documents changed → specific worker recipients (upload with known recipients). */
export function voidEmitDocumentsChangedToWorkers(
  workerIds: Iterable<string>,
  companyId: string,
): void {
  void notifyUsersModuleGated(
    [...workerIds],
    WS_EVENTS.DOCUMENTS_CHANGED,
    MODULE_KEYS.DOCUMENTS,
    companyId,
  );
}

/** Documents changed → all active workers in company (delete operations). */
export function voidEmitDocumentsChangedToAllCompanyWorkers(companyId: string): void {
  void (async () => {
    try {
      const companyOid = new mongoose.Types.ObjectId(companyId);
      const workers = await User.find({ companyId: companyOid, role: "worker", isActive: true })
        .select("_id")
        .lean();
      const ids = workers.map((w) => String(w._id));
      await notifyUsersModuleGated(ids, WS_EVENTS.DOCUMENTS_CHANGED, MODULE_KEYS.DOCUMENTS, companyId);
    } catch (err) {
      console.error("[ws-notify] voidEmitDocumentsChangedToAllCompanyWorkers failed:", err);
    }
  })();
}

/** Documents changed → company admins (worker read/ack). */
export function voidEmitDocumentsChangedToAdmins(companyId: string): void {
  void notifyCompanyAdminsModuleGated(
    companyId,
    WS_EVENTS.DOCUMENTS_CHANGED,
    MODULE_KEYS.DOCUMENTS,
  );
}

/** Payroll changed → specific worker recipients (upload/assign/invalidate with known recipients). */
export function voidEmitPayrollChangedToWorkers(
  workerIds: Iterable<string>,
  companyId: string,
): void {
  void notifyUsersModuleGated(
    [...workerIds],
    WS_EVENTS.PAYROLL_CHANGED,
    MODULE_KEYS.PAYROLL,
    companyId,
  );
}

/** Payroll changed → company admins. */
export function voidEmitPayrollChangedToAdmins(companyId: string): void {
  void notifyCompanyAdminsModuleGated(
    companyId,
    WS_EVENTS.PAYROLL_CHANGED,
    MODULE_KEYS.PAYROLL,
  );
}
