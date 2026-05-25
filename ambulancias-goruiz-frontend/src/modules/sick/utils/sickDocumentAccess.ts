/** Collects sick-leave document paths for secure openSecureFile usage. */
export function collectSickLeaveDocumentUrls(input: {
  documentUrl?: string;
  documents?: string[];
}): string[] {
  const urls = new Set<string>();
  if (input.documentUrl) urls.add(input.documentUrl);
  for (const doc of input.documents ?? []) {
    if (doc) urls.add(doc);
  }
  return [...urls];
}

export function isInternalUploadPath(url: string): boolean {
  return url.replace(/\\/g, "/").startsWith("/uploads/");
}
