import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Linking } from "react-native";

import { ENV } from "../config/env";
import { getAuthBearerToken, notifyUnauthorizedIfStatus } from "./http";

function sanitizeFilenameForCache(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function guessMimeType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

export function filenameFromUrlOrPath(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const { pathname } = new URL(trimmed);
      return pathname.split("/").filter(Boolean).pop() ?? null;
    } catch {
      return null;
    }
  }
  return trimmed.split("/").filter(Boolean).pop() ?? null;
}

export function buildPublicFileCandidates(rawUrl: string): string[] {
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return [rawUrl];
  }

  const normalizedPath = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  const apiBase = ENV.apiBaseUrl.replace(/\/+$/, "");
  const apiOrigin = apiBase.endsWith("/api") ? apiBase.slice(0, -4) : apiBase;

  return [`${apiOrigin}${normalizedPath}`, `${apiBase}${normalizedPath}`];
}

export async function downloadAndOpenAuthenticatedFile(filename: string): Promise<void> {
  const token = await getAuthBearerToken();
  if (!token) {
    throw new Error("Sesion no disponible.");
  }

  const apiRoot = ENV.apiBaseUrl.replace(/\/+$/, "");
  const url = `${apiRoot}/files/${encodeURIComponent(filename)}`;
  const safeName = sanitizeFilenameForCache(filename);
  const destFile = new File(Paths.cache, `worker-file-${Date.now()}-${safeName}`);
  const downloadedFile = await File.downloadFileAsync(url, destFile, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!downloadedFile?.uri) {
    await notifyUnauthorizedIfStatus(401);
    throw new Error("No se pudo descargar el archivo.");
  }

  const mimeType = guessMimeType(filename);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(downloadedFile.uri, {
      mimeType,
      UTI: mimeType === "application/pdf" ? "com.adobe.pdf" : undefined,
      dialogTitle: "Abrir archivo",
    });
    return;
  }

  const canOpen = await Linking.canOpenURL(downloadedFile.uri);
  if (canOpen) {
    await Linking.openURL(downloadedFile.uri);
    return;
  }

  throw new Error("No se pudo abrir el archivo en este dispositivo.");
}
