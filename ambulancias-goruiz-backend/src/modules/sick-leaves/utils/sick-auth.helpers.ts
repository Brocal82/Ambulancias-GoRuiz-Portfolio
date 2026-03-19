import { Request } from "express";

export function getAuthUserId(req: Request): string | undefined {
  return req.user?.id ?? req.userId;
}
