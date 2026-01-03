// frontend/src/utils/messages/buildAttachmentUrl.ts
import { getPublicUrl } from "../url";
import type { MessageAttachment } from "../../types/message";

/**
 * Construye la URL pública de un adjunto con cache-busting
 */
export const buildAttachmentUrl = (
  attachment: MessageAttachment,
  sentAt: string,
): string => {
  const version = `${encodeURIComponent(
    attachment.filename,
  )}-${encodeURIComponent(sentAt)}`;

  return `${getPublicUrl(attachment.url)}?v=${version}`;
};
