import mongoose from "mongoose";
import { Message } from "../models/message.model";
import User from "../../../models/User";

export type CreateMessageInput = {
  subject: string;
  body: string;
  senderId: string;
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

  if (input.toAllWorkers) {
    const workers = await User.find({ role: "worker" }).select("_id").lean();
    const allWorkerIds = workers.map((w) => w._id.toString());
    const set = new Set<string>([...finalRecipients, ...allWorkerIds]);
    finalRecipients = Array.from(set);
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
  });

  return newMessage;
}

export async function getMyMessages(userId: string, unreadOnly: boolean) {
  const userIdObj = new mongoose.Types.ObjectId(userId);
  const filter: Record<string, unknown> = {
    recipients: userIdObj,
    removedBy: { $ne: userIdObj },
  };
  if (unreadOnly) {
    filter.readBy = { $ne: userIdObj };
  }

  return await Message.find(filter)
    .sort({ sentAt: -1 })
    .populate("sender", "name lastName");
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
