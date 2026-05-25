import jwt from "jsonwebtoken";
import { env } from "../../../config/env";
import User from "../../users/models/user.model";
import UserSessionState from "../../users/models/user-session-state.model";

export type WsAuthResult =
  | { ok: true; userId: string }
  | { ok: false; reason: string };

/**
 * Validates a JWT for WebSocket connections.
 * Mirrors HTTP authenticateToken revocation checks (without role/company resolution).
 */
export async function authenticateWsToken(token: string): Promise<WsAuthResult> {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      userId?: string;
      tokenVersion?: number;
      typ?: string;
    };

    if (decoded.typ === "step_up") {
      return { ok: false, reason: "step_up token not allowed" };
    }

    const userId = String(decoded.userId ?? "");
    if (!userId) {
      return { ok: false, reason: "No userId" };
    }

    const userDoc = await User.findById(userId).select("isActive").lean();
    if (!userDoc || userDoc.isActive !== true) {
      return { ok: false, reason: "User inactive" };
    }

    const sessionState = await UserSessionState.findOne({ userId })
      .select("tokenVersion")
      .lean();
    const persistedVersion = Number((sessionState as { tokenVersion?: number })?.tokenVersion ?? 0);
    if (persistedVersion !== (decoded.tokenVersion ?? 0)) {
      return { ok: false, reason: "Token revoked" };
    }

    return { ok: true, userId };
  } catch {
    return { ok: false, reason: "Invalid token" };
  }
}
