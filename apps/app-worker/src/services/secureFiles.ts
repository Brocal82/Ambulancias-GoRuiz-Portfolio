import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Linking } from "react-native";

import { ENV } from "../config/env";
import {
  buildPublicUploadCandidates,
  isVerifiedPublicImageFilename,
  isVerifiedPublicImageMeta,
  shouldUseAuthenticatedFileRoute,
} from "../utils/secureFileRouting";
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

/** @deprecated Prefer buildPublicUploadCandidates or resolvePublicImageUrl. */
export function buildPublicFileCandidates(rawUrl: string): string[] {
  return buildPublicUploadCandidates(rawUrl, ENV.apiBaseUrl);
}

async function probePublicImageCandidate(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) return false;
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (contentType.includes("application/json")) return false;
    if (contentType.startsWith("image/")) {
      return (
        contentType.includes("jpeg") ||
        contentType.includes("png") ||
        contentType.includes("webp")
      );
    }
    return false;
  } catch {
    return false;
  }
}

/** Resolves a verified public image URL (uploads) after probing candidates. */
export async function resolvePublicImageUrl(rawUrl: string): Promise<string | null> {
  const filename = filenameFromUrlOrPath(rawUrl);
  if (!filename || !isVerifiedPublicImageFilename(filename)) {
    return null;
  }

  const candidates = buildPublicUploadCandidates(rawUrl, ENV.apiBaseUrl);
  for (const candidate of candidates) {
    const reachable = await probePublicImageCandidate(candidate);
    if (reachable) return candidate;
  }
  return null;
}

export async function downloadAndOpenAuthenticatedFile(filename: string): Promise<void> {
  const token = await getAuthBearerToken();
  if (!token) {
    throw new Error("Sesion no disponible.");
  }

  const apiRoot = ENV.apiBaseUrl.replace(/\/+$/, "");
  const url = `${apiRoot}/files/${encodeURIComponent(filename)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  await notifyUnauthorizedIfStatus(response.status);
  if (!response.ok) {
    throw new Error("No se pudo descargar el archivo.");
  }

  const safeName = sanitizeFilenameForCache(filename);
  const destFile = new File(Paths.cache, `worker-file-${Date.now()}-${safeName}`);
  const arrayBuffer = await response.arrayBuffer();
  destFile.write(new Uint8Array(arrayBuffer));

  const mimeType = guessMimeType(filename);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(destFile.uri, {
      mimeType,
      UTI: mimeType === "application/pdf" ? "com.adobe.pdf" : undefined,
      dialogTitle: "Abrir archivo",
    });
    return;
  }

  const canOpen = await Linking.canOpenURL(destFile.uri);
  if (canOpen) {
    await Linking.openURL(destFile.uri);
    return;
  }

  throw new Error("No se pudo abrir el archivo en este dispositivo.");
}

export type SecureAttachmentMeta = {
  mimetype?: string;
  originalName?: string;
};

export type OpenSecureAttachmentResult =
  | { kind: "authenticated" }
  | { kind: "public_image"; url: string }
  | { kind: "external"; url: string };

/**
 * Central secure attachment opener aligned with backend policy:
 * - PDFs and unknown files → authenticated /api/files/:filename
 * - Verified images → public /uploads probing only
 */
export async function openSecureAttachment(
  url: string,
  meta?: SecureAttachmentMeta,
): Promise<OpenSecureAttachmentResult> {
  if (shouldUseAuthenticatedFileRoute(meta)) {
    const filename = filenameFromUrlOrPath(url);
    if (!filename) {
      throw new Error("No se pudo leer el nombre del adjunto.");
    }
    await downloadAndOpenAuthenticatedFile(filename);
    return { kind: "authenticated" };
  }

  if (meta && isVerifiedPublicImageMeta(meta)) {
    const imageUrl = await resolvePublicImageUrl(url);
    if (!imageUrl) {
      throw new Error("No se pudo cargar la imagen.");
    }
    return { kind: "public_image", url: imageUrl };
  }

  const filename = filenameFromUrlOrPath(url);
  if (filename && isVerifiedPublicImageFilename(filename)) {
    const imageUrl = await resolvePublicImageUrl(url);
    if (imageUrl) {
      return { kind: "public_image", url: imageUrl };
    }
  }

  if (filename) {
    await downloadAndOpenAuthenticatedFile(filename);
    return { kind: "authenticated" };
  }

  throw new Error("No se pudo abrir el adjunto.");
}
