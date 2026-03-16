import SickLeave from "../models/sick-leave.model";

export async function getSickLeaveDocumentTarget(id: string) {
  return SickLeave.findById(id);
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
