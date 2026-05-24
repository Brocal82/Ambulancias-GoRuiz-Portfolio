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

/** Replacement toast when upload response includes replacedDocument. */
export function formatPayrollReplacementMessage(originalName: string): string {
  return `Nómina reemplazada: se invalidó la nómina activa anterior ("${originalName}").`;
}
