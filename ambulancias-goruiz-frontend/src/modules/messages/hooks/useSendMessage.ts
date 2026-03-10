//src/modules/messages/hooks/useSendMessage.ts
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toastT } from "../../../utils/toast";
import { sendMessage, sendMessageMultipart } from "../domain/api";

export type SendMessageArgs = {
  token: string;
  subject: string;
  body: string;
  recipients: string[];
  toAllWorkers?: boolean;
  attachments?: File[];
};

type UseSendMessageConfig = {
  token?: string; // ✅ opcional para no pasarlo cada vez
  onSuccess?: () => void | Promise<void>;
};

type SendResult =
  | { ok: true }
  | { ok: false; error: unknown };

export const useSendMessage = (config?: UseSendMessageConfig) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const send = async (args: SendMessageArgs): Promise<SendResult> => {
    setLoading(true);

    try {
      const token = args.token ?? config?.token;
      if (!token) {
        toastT.error(t("toasts.messages.error") || "Missing token");
        return { ok: false, error: new Error("Missing token") };
      }

      const hasAttachments = (args.attachments?.length ?? 0) > 0;

      if (hasAttachments) {
        const formData = new FormData();
        formData.append("subject", args.subject);
        formData.append("body", args.body);
        formData.append("recipients", JSON.stringify(args.recipients));
        if (typeof args.toAllWorkers !== "undefined") {
          formData.append("toAllWorkers", args.toAllWorkers ? "true" : "false");
        }

        args.attachments!.forEach((file) => {
          formData.append("attachment", file, file.name);
        });

        await sendMessageMultipart(token, formData);
      } else {
        await sendMessage(token, {
          subject: args.subject,
          body: args.body,
          recipients: args.recipients,
          toAllWorkers: args.toAllWorkers,
        });
      }

      toastT.success(["toasts.messages.sent"]);

      if (config?.onSuccess) await config.onSuccess();

      return { ok: true };
    } catch (error) {
      console.error("❌ Error al enviar mensaje:", error);
      const msg =
        (error as any)?.response?.data?.message ||
        (t("toasts.messages.error") as string) ||
        "Error sending the message";
      toastT.error(msg);
      return { ok: false, error };
    } finally {
      setLoading(false);
    }
  };

  return { send, loading };
};
