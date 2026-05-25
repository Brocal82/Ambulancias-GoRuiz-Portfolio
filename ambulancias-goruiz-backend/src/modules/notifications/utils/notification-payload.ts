/**
 * Shared push + websocket-adjacent payload contract.
 * Expo requires string values in the `data` object.
 */

export const NOTIFICATION_SCREENS = {
  MESSAGES: "messages",
  AGENDA: "agenda",
  VACATIONS: "vacations",
  SICK_LEAVES: "sickLeaves",
  APPOINTMENTS: "appointments",
  PRAEMIEN: "praemien",
  DOCUMENTS: "documents",
  WORKDAY: "workday",
} as const;

export type NotificationScreen =
  (typeof NOTIFICATION_SCREENS)[keyof typeof NOTIFICATION_SCREENS];

export type NotificationPayloadInput = {
  screen: NotificationScreen | string;
  type?: string;
  resourceId?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

export type NotificationPayloadData = Record<string, string>;

const LEGACY_RESOURCE_KEYS: Record<string, string> = {
  message_received: "messageId",
  sick_leave_accepted: "sickLeaveId",
  sick_leave_rejected: "sickLeaveId",
};

/** Builds a normalized payload with screen, type, resourceId, and optional metadata. */
export function buildNotificationData(
  input: NotificationPayloadInput,
): NotificationPayloadData {
  const data: NotificationPayloadData = {
    screen: String(input.screen),
  };

  if (input.type) {
    data.type = String(input.type);
  }

  if (input.resourceId) {
    data.resourceId = String(input.resourceId);
    const legacyKey = input.type ? LEGACY_RESOURCE_KEYS[input.type] : undefined;
    if (legacyKey) {
      data[legacyKey] = String(input.resourceId);
    }
  }

  if (input.metadata) {
    for (const [key, value] of Object.entries(input.metadata)) {
      if (value === undefined || value === null) continue;
      data[key] = String(value);
    }
  }

  return data;
}

/** Coerces arbitrary caller data to Expo-compatible string map (preserves existing keys). */
export function toExpoPushData(data: Record<string, unknown>): NotificationPayloadData {
  const out: NotificationPayloadData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    out[key] = String(value);
  }
  return out;
}
