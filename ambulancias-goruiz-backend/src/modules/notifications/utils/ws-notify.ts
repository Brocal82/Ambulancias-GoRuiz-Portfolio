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
