import axiosInstance from "../api/axios";

/**
 * Downloads a protected file via authenticated request and opens it in a new tab.
 * @param storedPath - The path stored in the DB, e.g. "/uploads/filename.pdf"
 * @param downloadName - Optional filename hint for the download attribute
 */
export async function openSecureFile(
  storedPath: string,
  downloadName?: string,
): Promise<void> {
  const filename = storedPath.split("/").pop();
  if (!filename) return;

  const response = await axiosInstance.get(`/api/files/${filename}`, {
    responseType: "blob",
  });

  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  if (downloadName) anchor.download = downloadName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
