import mongoose from "mongoose";
import PayrollDocument from "../models/payroll-document.model";
import { voidEmitPayrollChangedToAdmins } from "../../notifications/utils/ws-notify";

/**
 * P1.3 — Compliance Hardening: Payroll Open Evidence
 *
 * Records a successful authenticated worker access to a payroll file.
 * Only fires for worker role (admins previewing a file are excluded).
 *
 * Atomically:
 *  - Sets firstOpenedAt once (idempotent — never overwritten after first access).
 *  - Updates lastOpenedAt on every call.
 *  - Increments openCount by 1.
 *
 * After a successful update, emits payroll_changed to admins so the admin
 * list silently refreshes. Reuses the existing payroll_changed event;
 * no new websocket channels or notifications are introduced.
 *
 * This function is fire-and-forget safe — callers should void it and
 * attach a .catch(() => undefined) to avoid unhandled rejections.
 *
 * Multi-tenant: all queries are scoped to companyId + workerId.
 * No cross-company access is possible.
 */
export async function recordPayrollDocumentOpenForWorker(
  filename: string,
  workerId: string,
  companyId: string,
): Promise<void> {
  if (
    !filename ||
    !workerId ||
    !companyId ||
    !mongoose.Types.ObjectId.isValid(workerId) ||
    !mongoose.Types.ObjectId.isValid(companyId)
  ) {
    return;
  }

  const storedPath = `/uploads/${filename}`;
  const workerOid = new mongoose.Types.ObjectId(workerId);
  const companyOid = new mongoose.Types.ObjectId(companyId);
  const now = new Date();

  const result = await PayrollDocument.findOneAndUpdate(
    {
      workerId: workerOid,
      companyId: companyOid,
      fileUrl: storedPath,
      deletedAt: null,
    },
    [
      {
        $set: {
          firstOpenedAt: { $ifNull: ["$firstOpenedAt", now] },
          lastOpenedAt: now,
          openCount: { $add: [{ $ifNull: ["$openCount", 0] }, 1] },
        },
      },
    ],
  )
    .select("_id")
    .lean();

  if (result) {
    voidEmitPayrollChangedToAdmins(companyId);
  }
}
