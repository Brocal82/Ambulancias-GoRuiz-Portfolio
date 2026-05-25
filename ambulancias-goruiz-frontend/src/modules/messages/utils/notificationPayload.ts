/**
 * Normalized notification payload helpers for client-side handling.
 * Mirrors backend NOTIFICATION_SCREENS contract.
 */

export const NOTIFICATION_SCREENS = [
  "messages",
  "agenda",
  "vacations",
  "sickLeaves",
  "appointments",
  "praemien",
  "documents",
  "workday",
] as const;

export type NotificationScreen = (typeof NOTIFICATION_SCREENS)[number];

export type ParsedNotificationPayload = {
  screen: NotificationScreen | null;
  type: string | null;
  resourceId: string | null;
  raw: Record<string, unknown>;
};

export function parseNotificationPayload(
  data: Record<string, unknown> | null | undefined,
): ParsedNotificationPayload {
  const raw = data ?? {};
  const screenValue = raw.screen;
  const screen =
    typeof screenValue === "string" &&
    (NOTIFICATION_SCREENS as readonly string[]).includes(screenValue)
      ? (screenValue as NotificationScreen)
      : null;

  const type = typeof raw.type === "string" ? raw.type : null;
  const resourceId =
    typeof raw.resourceId === "string"
      ? raw.resourceId
      : typeof raw.messageId === "string"
        ? raw.messageId
        : null;

  return { screen, type, resourceId, raw };
}
