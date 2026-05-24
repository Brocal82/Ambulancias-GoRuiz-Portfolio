export function buildDocumentsUploadFormData(
  files: File[],
  requiresAcknowledgment: boolean,
): FormData {
  const formData = new FormData();
  files.forEach((f) => {
    formData.append("files", f);
  });
  if (files.length === 1 && requiresAcknowledgment) {
    formData.append("requiresAcknowledgment", "true");
  }
  return formData;
}
