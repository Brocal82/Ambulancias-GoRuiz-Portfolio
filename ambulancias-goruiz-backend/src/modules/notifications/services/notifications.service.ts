import mongoose from "mongoose";
import { PushToken } from "../models/push-token.model";

export async function registerPushToken(
  userId: string,
  token: string,
  platform: "ios" | "android",
): Promise<void> {
  await PushToken.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(userId) },
    { token, platform },
    { upsert: true, new: true },
  );
}

export async function sendPushNotification(
  userIds: string[],
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  if (userIds.length === 0) return;

  try {
    const tokens = await PushToken.find({
      userId: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) },
    })
      .select("token")
      .lean();

    if (tokens.length === 0) return;

    const messages = tokens.map((t) => ({
      to: (t as { token: string }).token,
      sound: "default" as const,
      title,
      body,
      data,
    }));

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.error("[Push] Expo API error:", response.status, await response.text());
    }
  } catch (err) {
    console.error("[Push] sendPushNotification failed:", err);
  }
}
