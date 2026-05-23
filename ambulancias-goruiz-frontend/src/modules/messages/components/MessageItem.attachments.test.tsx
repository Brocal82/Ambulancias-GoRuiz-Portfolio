import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MessageItem from "./MessageItem";
import { openSecureFile } from "../../../utils/openSecureFile";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_k: string, fb?: string) => fb ?? _k }),
}));

vi.mock("../../../utils/openSecureFile", () => ({
  openSecureFile: vi.fn(),
}));

describe("MessageItem attachments", () => {
  beforeEach(() => {
    vi.mocked(openSecureFile).mockReset();
  });

  it("abre adjuntos con openSecureFile (no URL pública directa)", () => {
    render(
      <MessageItem
        message={{
          _id: "m1",
          subject: "S",
          body: "B",
          sentAt: "2025-01-01T00:00:00.000Z",
          sender: { _id: "a1", name: "Admin", lastName: "Test" },
          recipients: ["w1"],
          readBy: [],
          attachments: [
            {
              filename: "f.pdf",
              originalName: "notice.pdf",
              url: "/uploads/f.pdf",
              mimetype: "application/pdf",
              size: 10,
            },
          ],
        }}
        isOpen={true}
        onToggle={() => {}}
      />,
    );

    fireEvent.click(screen.getByTitle("notice.pdf"));
    expect(openSecureFile).toHaveBeenCalledWith("/uploads/f.pdf", "notice.pdf");
  });
});
