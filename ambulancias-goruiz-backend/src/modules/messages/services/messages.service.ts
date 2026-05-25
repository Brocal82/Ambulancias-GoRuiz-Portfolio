import mongoose from "mongoose";
import { Message } from "../models/message.model";
import User from "../../users/models/user.model";
import {
  sendPushNotification,
  notifyUsers,
  buildNotificationData,
} from "../../notifications";
import { MODULE_KEYS } from "../../companies/constants/modules.constants";
import { unlinkUnreferencedMessageAttachments } from "../utils/messageAttachments";

export const MESSAGE_VALIDATION_ERROR = "Faltan datos obligatorios o receptores inválidos";
export const MESSAGE_NO_VALID_RECIPIENTS_ERROR =
  "No hay destinatarios válidos en tu empresa";

function normalizeRecipientIds(recipients: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of recipients) {
    const key = String(id).trim();
    if (!key || !mongoose.Types.ObjectId.isValid(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export type CreateMessageInput = {
  subject: string;
  body: string;
  senderId: string;
  senderCompanyId: string;
  toAllWorkers: boolean;
  recipients: string[];
  attachments: {
    originalName: string;
    filename: string;
    mimetype: string;
    size: number;
    url: string;
  }[];
};

export async function createMessage(input: CreateMessageInput) {
  let finalRecipients = normalizeRecipientIds(input.recipients ?? []);
  const companyIdObj = new mongoose.Types.ObjectId(input.senderCompanyId);

  if (input.toAllWorkers) {
    const workers = await User.find({
      role: "worker",
      companyId: companyIdObj,
    })
      .select("_id")
      .lean();
    const allWorkerIds = workers.map((w) => w._id.toString());
    finalRecipients = normalizeRecipientIds([...finalRecipients, ...allWorkerIds]);
  } else {
    const recipientsFromCompany = await User.find({
      _id: { $in: finalRecipients.map((id) => new mongoose.Types.ObjectId(id)) },
      companyId: companyIdObj,
    })
      .select("_id")
      .lean();
    const validIds = new Set(recipientsFromCompany.map((u) => u._id.toString()));
    finalRecipients = finalRecipients.filter((id) => validIds.has(id));
  }

  if (!input.subject?.trim() || !input.body?.trim()) {
    throw new Error(MESSAGE_VALIDATION_ERROR);
  }

  if (!Array.isArray(finalRecipients) || finalRecipients.length === 0) {
    throw new Error(MESSAGE_NO_VALID_RECIPIENTS_ERROR);
  }

  const newMessage = await Message.create({
    subject: input.subject,
    body: input.body,
    sender: input.senderId,
    recipients: finalRecipients,
    toAllWorkers: input.toAllWorkers,
    attachments: input.attachments,
    companyId: new mongoose.Types.ObjectId(input.senderCompanyId),
  });

  void sendPushNotification(
    finalRecipients,
    "Nuevo mensaje",
    input.subject,
    buildNotificationData({
      screen: "messages",
      type: "message_received",
      resourceId: String(newMessage._id),
    }),
    { moduleKey: MODULE_KEYS.MESSAGES, actingCompanyId: input.senderCompanyId },
  );

  notifyUsers(finalRecipients, "new_message");

  return newMessage;
}

export async function getMyMessages(
  userId: string,
  unreadOnly: boolean,
  userCompanyId?: string | null,
) {
  const userIdObj = new mongoose.Types.ObjectId(userId);
  const filter: Record<string, unknown> = {
    recipients: userIdObj,
    removedBy: { $ne: userIdObj },
  };
  if (unreadOnly) {
    filter.readBy = { $ne: userIdObj };
  }

  const companyStr =
    typeof userCompanyId === "string" ? userCompanyId.trim() : "";
  if (!companyStr || !mongoose.Types.ObjectId.isValid(companyStr)) {
    return [];
  }

  const companyOid = new mongoose.Types.ObjectId(companyStr);
  const senderRows = await User.find({
    companyId: companyOid,
    role: "admin",
  })
    .select("_id")
    .lean();
  const senderIds = senderRows.map((u) => u._id);
  if (senderIds.length === 0) {
    return [];
  }

  Object.assign(filter, { sender: { $in: senderIds } });

  return Message.find(filter)
    .sort({ sentAt: -1 })
    .populate("sender", "name lastName companyId");
}

export async function getSentMessages(adminId: string, companyId?: string) {
  const base = { sender: adminId, toAllWorkers: true };

  if (companyId && mongoose.Types.ObjectId.isValid(companyId)) {
    return await Message.find({
      ...base,
      $or: [
        { companyId: new mongoose.Types.ObjectId(companyId) },
        { companyId: null },
      ],
    })
      .sort({ sentAt: -1 })
      .select("subject body sentAt attachments");
  }

  return await Message.find(base)
    .sort({ sentAt: -1 })
    .select("subject body sentAt attachments");
}

export async function getMessagesForUserAsAdmin(
  adminId: string,
  userId: string,
  companyId?: string,
) {
  const filter: Record<string, unknown> = {
    sender: adminId,
    recipients: new mongoose.Types.ObjectId(userId),
  };

  if (companyId && mongoose.Types.ObjectId.isValid(companyId)) {
    filter.$or = [
      { companyId: new mongoose.Types.ObjectId(companyId) },
      { companyId: null },
    ];
  }

  return await Message.find(filter)
    .sort({ sentAt: -1 })
    .populate("sender", "name lastName");
}

export async function deleteMessageForUser(userId: string, messageId: string) {
  const userIdObj = new mongoose.Types.ObjectId(userId);
  const message = await Message.findById(messageId);

  if (!message) {
    return null;
  }

  if (!message.readBy.some((u) => u.toString() === userIdObj.toString())) {
    message.readBy.push(userIdObj);
  }
  if (
    !message.removedBy?.some((u) => u.toString() === userIdObj.toString())
  ) {
    (message.removedBy as mongoose.Types.ObjectId[] | undefined)?.push(
      userIdObj,
    );
  }

  await message.save();
  return message;
}

export async function deleteMessageByAdmin(
  adminId: string,
  messageId: string,
  companyId?: string,
) {
  const message = await Message.findById(messageId);

  if (!message) {
    return { kind: "not_found" as const };
  }

  if (message.sender.toString() !== adminId) {
    return { kind: "forbidden" as const };
  }

  if (companyId) {
    if (message.companyId) {
      if (String(message.companyId) !== String(companyId)) {
        return { kind: "forbidden" as const };
      }
    } else {
      const sender = await User.findById(adminId).select("companyId").lean();
      const senderCompanyId = sender ? (sender as { companyId?: unknown }).companyId : null;
      if (!senderCompanyId || String(senderCompanyId) !== String(companyId)) {
        return { kind: "forbidden" as const };
      }
    }
  }

  const attachments = message.attachments ?? [];
  await Message.deleteOne({ _id: messageId });
  await unlinkUnreferencedMessageAttachments(attachments);
  return { kind: "deleted" as const };
}

export async function markMessageAsRead(userId: string, messageId: string) {
  const userIdObj = new mongoose.Types.ObjectId(userId);
  const message = await Message.findById(messageId);

  if (!message) {
    return null;
  }

  if (!message.readBy.some((u) => u.toString() === userIdObj.toString())) {
    message.readBy.push(userIdObj);
    await message.save();
  }

  return { ok: true };
}
