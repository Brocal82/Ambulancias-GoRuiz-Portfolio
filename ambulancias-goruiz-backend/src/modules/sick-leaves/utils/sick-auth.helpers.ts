import { Request } from "express";

export function getAuthUserId(req: Request): string | undefined {
  return (req as any)?.user?.id || (req as any)?.userId;
}
