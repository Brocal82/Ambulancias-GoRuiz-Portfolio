import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError } from "../services/http";
import {
  deleteMessageForUser,
  getMyMessages,
  markMessageAsRead,
  WorkerMessage,
} from "../services/messages";
import {
  buildPublicFileCandidates,
  downloadAndOpenAuthenticatedFile,
  filenameFromUrlOrPath,
} from "../services/secureFiles";

type Props = {
  userId: string;
};

function sortBySentDateDesc(messages: WorkerMessage[]): WorkerMessage[] {
  return [...messages].sort((a, b) => {
    const aTime = new Date(a.sentAt).getTime();
    const bTime = new Date(b.sentAt).getTime();
    return bTime - aTime;
  });
}

async function isReachableAttachmentUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) return false;
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    // Avoid opening JSON error payloads as blank browser tabs.
    if (contentType.includes("application/json")) return false;
    return true;
  } catch {
    return false;
  }
}

function isImageAttachment(attachment: { mimetype: string; originalName: string }): boolean {
  const mime = (attachment.mimetype ?? "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  const lowerName = (attachment.originalName ?? "").toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].some((ext) => lowerName.endsWith(ext));
}

function isPdfAttachment(attachment: { mimetype: string; originalName: string }): boolean {
  const mime = (attachment.mimetype ?? "").toLowerCase();
  if (mime === "application/pdf") return true;
  return (attachment.originalName ?? "").toLowerCase().endsWith(".pdf");
}

export function WorkerMessagesScreen({ userId }: Props) {
  const [messages, setMessages] = useState<WorkerMessage[]>([]);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(undefined);
    try {
      const allMessages = await getMyMessages({ unreadOnly: false });
      setMessages(sortBySentDateDesc(allMessages));
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("No se pudieron cargar los mensajes.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMessages();

    const intervalId = setInterval(() => {
      void loadMessages();
    }, 20000);

    return () => {
      clearInterval(intervalId);
    };
  }, [loadMessages]);

  const unreadCount = useMemo(() => {
    return messages.reduce((acc, message) => {
      const isUnread = !(message.readBy ?? []).some((id) => String(id) === userId);
      return isUnread ? acc + 1 : acc;
    }, 0);
  }, [messages, userId]);

  const toggleMessage = async (message: WorkerMessage) => {
    const isOpening = !expandedIds[message._id];
    setExpandedIds((prev) => ({ ...prev, [message._id]: !prev[message._id] }));

    const isUnread = !(message.readBy ?? []).some((id) => String(id) === userId);
    if (!isOpening || !isUnread) {
      return;
    }

    try {
      await markMessageAsRead(message._id);
      setMessages((prev) =>
        prev.map((current) =>
          current._id === message._id
            ? {
                ...current,
                readBy: Array.from(new Set([...(current.readBy ?? []), userId])),
              }
            : current,
        ),
      );
    } catch {
      // non-blocking: keep local toggle and allow manual refresh
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      await deleteMessageForUser(messageId);
      setMessages((prev) => prev.filter((message) => message._id !== messageId));
      setExpandedIds((prev) => {
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
    } catch {
      setErrorMessage("No se pudo eliminar el mensaje.");
    }
  };

  const openAttachment = async (
    url: string,
    attachmentMeta?: { mimetype: string; originalName: string },
  ) => {
    setErrorMessage(undefined);

    if (attachmentMeta && isPdfAttachment(attachmentMeta)) {
      const filename = filenameFromUrlOrPath(url);
      if (!filename) {
        setErrorMessage("No se pudo leer el nombre del adjunto.");
        return;
      }
      try {
        await downloadAndOpenAuthenticatedFile(filename);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "No se pudo abrir el PDF.");
      }
      return;
    }

    if (attachmentMeta && isImageAttachment(attachmentMeta)) {
      const candidates = buildPublicFileCandidates(url);
      for (const candidate of candidates) {
        const reachable = await isReachableAttachmentUrl(candidate);
        if (!reachable) continue;
        setPreviewImageUrl(candidate);
        return;
      }
      setErrorMessage("No se pudo cargar la imagen.");
      return;
    }

    const candidates = buildPublicFileCandidates(url);
    for (const candidate of candidates) {
      const reachable = await isReachableAttachmentUrl(candidate);
      if (!reachable) continue;

      const canOpen = await Linking.canOpenURL(candidate);
      if (!canOpen) continue;

      await Linking.openURL(candidate);
      return;
    }

    setErrorMessage("No se pudo abrir el adjunto. Verifica URL/uploads en backend.");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Mensajes</Text>
        <Text style={styles.subtitle}>Comunicaciones operativas internas</Text>
        <Text style={styles.badgeUnread}>No leidos: {unreadCount}</Text>
        <Pressable style={styles.refreshButton} onPress={() => void loadMessages()}>
          <Text style={styles.refreshButtonText}>Refrescar</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#0f766e" />
          <Text style={styles.centerText}>Cargando mensajes...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadMessages()}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.centerText}>No hay mensajes para mostrar.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {messages.map((message) => {
            const isUnread = !(message.readBy ?? []).some((id) => String(id) === userId);
            const isExpanded = Boolean(expandedIds[message._id]);
            return (
              <View key={message._id} style={styles.messageCard}>
                <Pressable
                  style={styles.messageHeader}
                  onPress={() => {
                    void toggleMessage(message);
                  }}
                >
                  <View style={[styles.dot, isUnread ? styles.dotUnread : styles.dotRead]} />
                  <View style={styles.headerTextBlock}>
                    <Text style={styles.messageSubject}>{message.subject}</Text>
                    <Text style={styles.messageMeta}>
                      De {message.sender?.lastName}, {message.sender?.name} ·{" "}
                      {new Date(message.sentAt).toLocaleString("es-ES")}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>{isExpanded ? "▴" : "▾"}</Text>
                </Pressable>

                {isExpanded ? (
                  <View style={styles.messageBodyBlock}>
                    <Text style={styles.messageBody}>{message.body}</Text>

                    {(message.attachments ?? []).length > 0 ? (
                      <View style={styles.attachmentsBlock}>
                        <Text style={styles.attachmentsTitle}>Adjuntos</Text>
                        {(message.attachments ?? []).map((attachment) => (
                          <Pressable
                            key={attachment.filename}
                            style={styles.attachmentChip}
                            onPress={() => {
                              void openAttachment(attachment.url, {
                                mimetype: attachment.mimetype,
                                originalName: attachment.originalName,
                              });
                            }}
                          >
                            <Text style={styles.attachmentText}>{attachment.originalName}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}

                    <Pressable
                      style={styles.deleteButton}
                      onPress={() => {
                        void handleDelete(message._id);
                      }}
                    >
                      <Text style={styles.deleteButtonText}>Eliminar</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal
        visible={previewImageUrl !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUrl(null)}
      >
        <View style={styles.previewOverlay}>
          <Pressable style={styles.previewCloseButton} onPress={() => setPreviewImageUrl(null)}>
            <Text style={styles.previewCloseText}>Cerrar</Text>
          </Pressable>
          {previewImageUrl ? (
            <Image source={{ uri: previewImageUrl }} style={styles.previewImage} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  badgeUnread: {
    marginTop: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#0f766e",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    color: "#0f766e",
    fontSize: 12,
    fontWeight: "700",
  },
  refreshButton: {
    marginTop: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  refreshButtonText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 12,
  },
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  centerText: {
    color: "#64748b",
  },
  errorText: {
    color: "#b91c1c",
    textAlign: "center",
  },
  retryButton: {
    borderWidth: 1,
    borderColor: "#0f766e",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
  },
  retryButtonText: {
    color: "#0f766e",
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  messageCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    overflow: "hidden",
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotUnread: {
    backgroundColor: "#ef4444",
  },
  dotRead: {
    backgroundColor: "#94a3b8",
  },
  headerTextBlock: {
    flex: 1,
    gap: 2,
  },
  messageSubject: {
    color: "#0f172a",
    fontWeight: "700",
  },
  messageMeta: {
    color: "#64748b",
    fontSize: 12,
  },
  chevron: {
    color: "#334155",
    fontSize: 16,
  },
  messageBodyBlock: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  messageBody: {
    color: "#334155",
    lineHeight: 20,
  },
  attachmentsBlock: {
    gap: 6,
  },
  attachmentsTitle: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  attachmentChip: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  attachmentText: {
    color: "#334155",
    fontSize: 12,
  },
  deleteButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff1f2",
  },
  deleteButtonText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "700",
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  previewCloseButton: {
    position: "absolute",
    top: 52,
    right: 20,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#0f172a",
    zIndex: 10,
  },
  previewCloseText: {
    color: "#e2e8f0",
    fontWeight: "700",
    fontSize: 12,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
});
