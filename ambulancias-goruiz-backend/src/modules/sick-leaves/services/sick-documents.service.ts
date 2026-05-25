import SickLeave from "../models/sick-leave.model";
import { validateSickDocumentStoredPath } from "../utils/sick-document.validation";

export async function getSickLeaveDocumentTarget(id: string) {
  return SickLeave.findById(id);
}

export function validateSickLeaveDocumentUrl(
  documentUrl: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  return validateSickDocumentStoredPath(documentUrl);
}

export async function attachDocumentToSickLeave(input: {
  sick: any;
  documentUrl: string;
}) {
  const { sick, documentUrl } = input;

  if (!Array.isArray((sick as any).documents)) {
    (sick as any).documents = [];
  }

  (sick as any).documents.push(documentUrl);
  sick.documentUrl = documentUrl;

  if (sick.requiresDocument && sick.verificationStatus === "pending") {
    sick.verificationStatus = "received";
  }

  await sick.save();
  return sick;
}
