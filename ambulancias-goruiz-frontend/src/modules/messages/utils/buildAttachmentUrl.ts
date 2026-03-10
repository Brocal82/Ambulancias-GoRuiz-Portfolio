// src/modules/messages/utils/buildAttachmentUrl.ts
import { getPublicUrl } from "../../../utils/url";
import type { MessageAttachment } from "../domain/types";

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
