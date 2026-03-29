import mongoose from "mongoose";
import { Message } from "../models/message.model";
import User from "../../users/models/user.model";

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
  let finalRecipients = input.recipients ?? [];
  const companyIdObj = new mongoose.Types.ObjectId(input.senderCompanyId);

  if (input.toAllWorkers) {
    const workers = await User.find({
      role: "worker",
      companyId: companyIdObj,
    })
      .select("_id")
      .lean();
    const allWorkerIds = workers.map((w) => w._id.toString());
    const set = new Set<string>([...finalRecipients, ...allWorkerIds]);
    finalRecipients = Array.from(set);
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

  if (
    !input.subject ||
    !input.body ||
    !Array.isArray(finalRecipients) ||
    finalRecipients.length === 0
  ) {
    throw new Error("Faltan datos obligatorios o receptores inválidos");
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

export async function getSentMessages(adminId: string) {
  return await Message.find({
    sender: adminId,
    toAllWorkers: true,
  })
    .sort({ sentAt: -1 })
    .select("subject body sentAt attachments");
}

export async function getMessagesForUserAsAdmin(adminId: string, userId: string) {
  return await Message.find({
    sender: adminId,
    recipients: new mongoose.Types.ObjectId(userId),
  })
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

export async function deleteMessageByAdmin(adminId: string, messageId: string) {
  const message = await Message.findById(messageId);

  if (!message) {
    return { kind: "not_found" as const };
  }

  if (message.sender.toString() !== adminId) {
    return { kind: "forbidden" as const };
  }

  await Message.deleteOne({ _id: messageId });
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
