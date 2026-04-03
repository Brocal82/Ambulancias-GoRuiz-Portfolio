import mongoose from "mongoose";
import User from "../modules/users/models/user.model";
import SickLeave from "../modules/sick-leaves/models/sick-leave.model";
import { Message } from "../modules/messages/models/message.model";
import PayrollDocument from "../modules/payroll/models/payroll-document.model";
import { isSameCompany } from "./requireCompany";

/**
 * Returns true if the requesting user is authorized to access the given file.
 *
 * Authorization is checked per file category:
 *   - User.pscheinDocument: owner or admin of same company
 *   - SickLeave.documents[] / documentUrl:    owner or admin of same company
 *                                              (legacy companyId=null uses user fallback)
 *   - Message.attachments[].url:              sender or explicit recipient only
 *   - PayrollDocument.fileUrl:                worker who owns it, or admin of same company
 *
 * Same-company alone is NOT sufficient for workers — they may only access
 * files they directly own or are explicitly authorized to view.
 */
export async function canAccessFile(
  filename: string,
  userId: string,
  userRole: string,
  companyId: string | null | undefined,
): Promise<boolean> {
  const storedPath = `/uploads/${filename}`;
  const userOid = new mongoose.Types.ObjectId(userId);

  // ── 1. User.pscheinDocument — direct ownership ─────────────────────────────
  const ownUserDoc = await User.findOne({
    _id: userOid,
    pscheinDocument: storedPath,
  })
    .select("_id")
    .lean();
  if (ownUserDoc) return true;

  // ── 2. User.pscheinDocument — admin of same company ───────────────────────
  if (
    userRole === "admin" &&
    companyId &&
    mongoose.Types.ObjectId.isValid(companyId)
  ) {
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const adminUserDoc = await User.findOne({
      companyId: companyOid,
      pscheinDocument: storedPath,
    })
      .select("_id")
      .lean();
    if (adminUserDoc) return true;
  }

  // ── 3. SickLeave.documents[] / documentUrl — direct ownership ────────────
  const ownSickLeave = await SickLeave.findOne({
    user: userOid,
    $or: [{ documents: storedPath }, { documentUrl: storedPath }],
  })
    .select("_id")
    .lean();
  if (ownSickLeave) return true;

  // ── 4. SickLeave.documents[] / documentUrl — admin of same company ────────
  if (
    userRole === "admin" &&
    companyId &&
    mongoose.Types.ObjectId.isValid(companyId)
  ) {
    const companyOid = new mongoose.Types.ObjectId(companyId);

    // New records: companyId stored directly on SickLeave
    const adminSickLeave = await SickLeave.findOne({
      companyId: companyOid,
      $or: [{ documents: storedPath }, { documentUrl: storedPath }],
    })
      .select("_id")
      .lean();
    if (adminSickLeave) return true;

    // Legacy records: companyId = null — fall back to the user's companyId
    const legacySickLeave = await SickLeave.findOne({
      companyId: null,
      $or: [{ documents: storedPath }, { documentUrl: storedPath }],
    })
      .populate<{ user: { companyId?: unknown } }>("user", "companyId")
      .lean();
    if (legacySickLeave) {
      const userDoc = legacySickLeave.user as
        | { companyId?: unknown }
        | undefined;
      if (isSameCompany(userDoc?.companyId, companyId)) return true;
    }
  }

  // ── 5. Message.attachments[].url — sender or explicit recipient only ──────
  const messageMatch = await Message.findOne({
    "attachments.url": storedPath,
    $or: [{ sender: userOid }, { recipients: userOid }],
  })
    .select("_id")
    .lean();
  if (messageMatch) return true;

  // ── 6. PayrollDocument — worker direct ownership ──────────────────────────
  const ownPayroll = await PayrollDocument.findOne({
    workerId: userOid,
    fileUrl: storedPath,
  })
    .select("_id")
    .lean();
  if (ownPayroll) return true;

  // ── 6b. PayrollDocument — admin of same company ───────────────────────────
  if (
    userRole === "admin" &&
    companyId &&
    mongoose.Types.ObjectId.isValid(companyId)
  ) {
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const adminPayroll = await PayrollDocument.findOne({
      companyId: companyOid,
      fileUrl: storedPath,
    })
      .select("_id")
      .lean();
    if (adminPayroll) return true;
  }

  return false;
}
