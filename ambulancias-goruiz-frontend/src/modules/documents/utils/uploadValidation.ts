const PDF_MIME = "application/pdf";

export function hasPdfExtension(name: string): boolean {
  return name.trim().toLowerCase().endsWith(".pdf");
}

export function isPdfFile(file: File): boolean {
  if (file.type === PDF_MIME) return true;
  return hasPdfExtension(file.name);
}

export function filterPdfFiles(files: File[]): {
  valid: File[];
  rejected: File[];
} {
  const valid: File[] = [];
  const rejected: File[] = [];
  for (const file of files) {
    if (isPdfFile(file)) {
      valid.push(file);
    } else {
      rejected.push(file);
    }
  }
  return { valid, rejected };
}

/** Acknowledgment checkbox is only meaningful for a single-file upload. */
export function isAcknowledgmentUploadEnabled(fileCount: number): boolean {
  return fileCount === 1;
}
