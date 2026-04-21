import axiosInstance from "../api/axios";

/**
 * Fetches a protected file via authenticated request and opens it inline in a new tab.
 * The second parameter is kept for backwards-compatibility but is no longer used.
 * @param storedPath - The path stored in the DB, e.g. "/uploads/filename.pdf"
 */
export async function openSecureFile(
  storedPath: string,
  _downloadName?: string,
): Promise<void> {
  const filename = storedPath.split("/").pop();
  if (!filename) return;

  const response = await axiosInstance.get(`/api/files/${filename}`, {
    responseType: "blob",
  });

  const blob = new Blob([response.data], { type: response.data.type });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
