import { describe, it, expect, vi, beforeEach } from "vitest";
import api from "../../../api/axios";
import {
  getMyMessages,
  sendMessageMultipart,
  markMessageAsRead,
  deleteMessageForUser,
} from "./api";

vi.mock("../../../api/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("messages domain api", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.patch).mockReset();
  });

  it("getMyMessages pasa unreadOnly como query string", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    await getMyMessages({ unreadOnly: false });
    expect(api.get).toHaveBeenCalledWith("/messages", {
      params: { unreadOnly: "false" },
    });
  });

  it("sendMessageMultipart envía FormData sin Content-Type manual", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { _id: "m1" } });
    const formData = new FormData();
    formData.append("subject", "S");
    formData.append("body", "B");
    formData.append("recipients", JSON.stringify(["abc123"]));
    formData.append("attachment", new File(["x"], "a.pdf", { type: "application/pdf" }));

    await sendMessageMultipart(formData);

    expect(api.post).toHaveBeenCalledWith("/messages", formData);
    const postMock = vi.mocked(api.post);
    const thirdArg = postMock.mock.calls[0]?.[2] as
      | { headers?: Record<string, string> }
      | undefined;
    expect(thirdArg?.headers?.["Content-Type"]).toBeUndefined();
  });

  it("markMessageAsRead usa PATCH /messages/:id/read", async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { ok: true } });
    await markMessageAsRead("msg1");
    expect(api.patch).toHaveBeenCalledWith("/messages/msg1/read", null);
  });

  it("deleteMessageForUser usa PATCH /messages/:id/remove", async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    await deleteMessageForUser("msg2");
    expect(api.patch).toHaveBeenCalledWith("/messages/msg2/remove", null);
  });
});
