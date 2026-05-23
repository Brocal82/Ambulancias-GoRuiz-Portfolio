import path from "path";
import fs from "fs/promises";
import { Message } from "../models/message.model";

const uploadsDir = path.join(__dirname, "../../../../uploads");

export type MessageAttachmentRef = {
  url?: string;
  filename?: string;
};

function resolveUploadPath(url: string): string | null {
  if (!url.startsWith("/uploads/")) return null;
  const basename = path.basename(url);
  if (!basename || basename.includes("..")) return null;
  return path.join(uploadsDir, basename);
}

async function unlinkPathIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (err: unknown) {
    const code =
      err && typeof err === "object" && "code" in err
        ? (err as { code?: string }).code
        : "";
    if (code !== "ENOENT") {
      console.warn("[messages] no se pudo borrar adjunto:", filePath, err);
    }
  }
}

/**
 * Elimina ficheros de adjuntos que ya no están referenciados en ningún Message.
 */
export async function unlinkUnreferencedMessageAttachments(
  attachments: MessageAttachmentRef[] | undefined,
): Promise<void> {
  if (!attachments?.length) return;

  for (const att of attachments) {
    const url = typeof att.url === "string" ? att.url.trim() : "";
    if (!url) continue;

    const stillReferenced = await Message.exists({ "attachments.url": url });
    if (stillReferenced) continue;

    const filePath = resolveUploadPath(url);
    if (filePath) await unlinkPathIfExists(filePath);
  }
}
