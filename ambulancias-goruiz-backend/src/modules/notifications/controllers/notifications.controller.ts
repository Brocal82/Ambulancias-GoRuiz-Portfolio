import { Request, Response } from "express";
import { z } from "zod";
import {
  registerPushToken,
  unregisterPushToken,
  getNotificationHistory,
} from "../services/notifications.service";

const registerSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["ios", "android"]),
});

const unregisterSchema = z.object({
  token: z.string().min(1).optional(),
});

export async function registerToken(req: Request, res: Response): Promise<void> {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "token y platform son obligatorios" });
    return;
  }
  await registerPushToken(req.userId as string, parsed.data.token, parsed.data.platform);
  res.status(200).json({ ok: true });
}

export async function unregisterToken(req: Request, res: Response): Promise<void> {
  const parsed = unregisterSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "token inválido" });
    return;
  }
  await unregisterPushToken(req.userId as string, parsed.data.token);
  res.status(200).json({ ok: true });
}

export async function getHistory(req: Request, res: Response): Promise<void> {
  const userId = req.userId as string;
  const history = await getNotificationHistory(userId);
  res.status(200).json(history);
}
