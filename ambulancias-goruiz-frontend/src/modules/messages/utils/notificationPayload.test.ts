import { describe, it, expect } from "vitest";
import { parseNotificationPayload } from "./notificationPayload";

describe("notificationPayload", () => {
  it("parseNotificationPayload normaliza screen, type y resourceId", () => {
    expect(
      parseNotificationPayload({
        screen: "messages",
        type: "message_received",
        messageId: "abc",
      }),
    ).toEqual({
      screen: "messages",
      type: "message_received",
      resourceId: "abc",
      raw: {
        screen: "messages",
        type: "message_received",
        messageId: "abc",
      },
    });
  });

  it("parseNotificationPayload devuelve null para pantallas desconocidas", () => {
    expect(parseNotificationPayload({ screen: "unknown" }).screen).toBeNull();
  });
});
