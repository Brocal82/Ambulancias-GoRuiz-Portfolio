import { describe, it, expect } from "vitest";
import { buildDocumentsUploadFormData } from "./buildUploadFormData";

describe("buildDocumentsUploadFormData", () => {
  it("append files y requiresAcknowledgment solo con un PDF", () => {
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    const formData = buildDocumentsUploadFormData([file], true);
    expect([...formData.keys()]).toEqual(["files", "requiresAcknowledgment"]);
    expect(formData.get("requiresAcknowledgment")).toBe("true");
  });

  it("no envía requiresAcknowledgment con varios archivos", () => {
    const a = new File(["x"], "a.pdf", { type: "application/pdf" });
    const b = new File(["y"], "b.pdf", { type: "application/pdf" });
    const formData = buildDocumentsUploadFormData([a, b], true);
    expect(formData.get("requiresAcknowledgment")).toBeNull();
    expect([...formData.getAll("files")]).toHaveLength(2);
  });

  it("no envía requiresAcknowledgment cuando el flag es false", () => {
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    const formData = buildDocumentsUploadFormData([file], false);
    expect(formData.get("requiresAcknowledgment")).toBeNull();
  });
});
