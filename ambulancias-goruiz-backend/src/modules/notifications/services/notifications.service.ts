import mongoose from "mongoose";
import { PushToken } from "../models/push-token.model";
import { NotificationLog } from "../models/notification-log.model";
import {
  toExpoPushData,
  type NotificationPayloadData,
} from "../utils/notification-payload";
import {
  filterPushRecipients,
  type FilterPushRecipientsOptions,
} from "../utils/push-recipients";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const STALE_EXPO_ERRORS = new Set([
  "DeviceNotRegistered",
  "InvalidCredentials",
]);

type ExpoPushTicket = {
  status?: string;
  details?: { error?: string };
};

export async function registerPushToken(
  userId: string,
  token: string,
  platform: "ios" | "android",
): Promise<void> {
  const userOid = new mongoose.Types.ObjectId(userId);

  // Same physical device re-registering under a new account: drop stale owner rows.
  await PushToken.deleteMany({ token, userId: { $ne: userOid } });

  await PushToken.findOneAndUpdate(
    { userId: userOid, token },
    { platform },
    { upsert: true, new: true },
  );
}

export async function unregisterPushToken(
  userId: string,
  token?: string,
): Promise<void> {
  const filter: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
  };
  if (token) {
    filter.token = token;
  }
  await PushToken.deleteMany(filter);
}

async function removeStalePushTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  await PushToken.deleteMany({ token: { $in: tokens } });
}

async function handleExpoPushResponse(
  tokenList: string[],
  response: Response,
): Promise<void> {
  let body: { data?: ExpoPushTicket[] } | null = null;
  try {
    body = (await response.json()) as { data?: ExpoPushTicket[] };
  } catch {
    if (!response.ok) {
      console.error("[Push] Expo API error:", response.status);
    }
    return;
  }

  if (!response.ok) {
    console.error("[Push] Expo API error:", response.status, body);
    return;
  }

  const tickets = body?.data ?? [];
  const staleTokens: string[] = [];

  tickets.forEach((ticket, index) => {
    if (ticket.status !== "error") return;
    const errorCode = ticket.details?.error;
    if (!errorCode || !STALE_EXPO_ERRORS.has(errorCode)) return;
    const token = tokenList[index];
    if (token) staleTokens.push(token);
  });

  if (staleTokens.length > 0) {
    await removeStalePushTokens(staleTokens);
  }
}

export type SendPushNotificationOptions = FilterPushRecipientsOptions;

export async function sendPushNotification(
  userIds: string[],
  title: string,
  body: string,
  data: Record<string, unknown> | NotificationPayloadData = {},
  options?: SendPushNotificationOptions,
): Promise<void> {
  if (userIds.length === 0) return;

  let targetUserIds = userIds;
  if (options?.moduleKey || options?.actingCompanyId) {
    targetUserIds = await filterPushRecipients(userIds, options);
  }
  if (targetUserIds.length === 0) return;

  const validUserOids = targetUserIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (validUserOids.length === 0) return;

  const expoData = toExpoPushData(data);

  void NotificationLog.insertMany(
    validUserOids.map((uid) => ({ userId: uid, title, body, data: expoData })),
  ).catch((err) => console.error("[Push] Failed to log notifications:", err));

  try {
    const tokens = await PushToken.find({
      userId: { $in: validUserOids },
    })
      .select("token")
      .lean();

    if (tokens.length === 0) return;

    const tokenList = tokens.map((t) => (t as { token: string }).token);

    const messages = tokenList.map((token) => ({
      to: token,
      sound: "default" as const,
      title,
      body,
      data: expoData,
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });

    await handleExpoPushResponse(tokenList, response);
  } catch (err) {
    console.error("[Push] sendPushNotification failed:", err);
  }
}

export async function getNotificationHistory(
  userId: string,
  limit = 50,
): Promise<INotificationLogItem[]> {
  const docs = await NotificationLog.find({
    userId: new mongoose.Types.ObjectId(userId),
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("title body data createdAt")
    .lean();

  return docs as unknown as INotificationLogItem[];
}

export interface INotificationLogItem {
  _id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  createdAt: string;
}

// Exported for focused unit tests (not part of public API surface).
export const __pushTestHooks = {
  handleExpoPushResponse,
  removeStalePushTokens,
  STALE_EXPO_ERRORS,
};
