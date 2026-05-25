import {
  buildNotificationData,
  toExpoPushData,
  NOTIFICATION_SCREENS,
} from "../modules/notifications/utils/notification-payload";

describe("notification-payload", () => {
  it("buildNotificationData normalizes screen, type, resourceId, and metadata", () => {
    const data = buildNotificationData({
      screen: NOTIFICATION_SCREENS.MESSAGES,
      type: "message_received",
      resourceId: "abc123",
      metadata: { status: "pending", count: 2 },
    });

    expect(data).toEqual({
      screen: "messages",
      type: "message_received",
      resourceId: "abc123",
      messageId: "abc123",
      status: "pending",
      count: "2",
    });
  });

  it("toExpoPushData stringifies all values for Expo compatibility", () => {
    expect(
      toExpoPushData({
        screen: "agenda",
        date: "2025-05-25",
        active: true,
        skip: null,
      }),
    ).toEqual({
      screen: "agenda",
      date: "2025-05-25",
      active: "true",
    });
  });
});
