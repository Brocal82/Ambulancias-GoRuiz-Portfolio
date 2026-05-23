import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSendMessage } from "./useSendMessage";
import * as api from "../domain/api";
import * as messageEvents from "../utils/messageEvents";

vi.mock("../domain/api", () => ({
  sendMessage: vi.fn(),
  sendMessageMultipart: vi.fn(),
}));

vi.mock("../utils/messageEvents", () => ({
  emitMessagesChanged: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../utils/toast", () => ({
  toastT: {
    success: vi.fn(),
    error: vi.fn(),
    apiError: vi.fn(),
  },
}));

describe("useSendMessage multipart", () => {
  beforeEach(() => {
    vi.mocked(api.sendMessage).mockReset();
    vi.mocked(api.sendMessageMultipart).mockReset();
    vi.mocked(messageEvents.emitMessagesChanged).mockReset();
  });

  it("construye FormData con subject, body, recipients y attachment", async () => {
    vi.mocked(api.sendMessageMultipart).mockResolvedValue({ _id: "m1" });

    const { result } = renderHook(() => useSendMessage({ token: "tok" }));
    const file = new File(["bytes"], "doc.pdf", { type: "application/pdf" });

    await act(async () => {
      await result.current.send({
        token: "tok",
        subject: "Asunto",
        body: "Cuerpo",
        recipients: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439011"],
        attachments: [file],
      });
    });

    expect(api.sendMessageMultipart).toHaveBeenCalledTimes(1);
    const formData = vi.mocked(api.sendMessageMultipart).mock.calls[0]?.[0] as FormData;
    expect(formData.get("subject")).toBe("Asunto");
    expect(formData.get("body")).toBe("Cuerpo");
    expect(formData.get("recipients")).toBe(
      JSON.stringify(["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439011"]),
    );
    const attachment = formData.get("attachment");
    expect(attachment).toBeInstanceOf(File);
    expect(messageEvents.emitMessagesChanged).toHaveBeenCalled();
  });
});
