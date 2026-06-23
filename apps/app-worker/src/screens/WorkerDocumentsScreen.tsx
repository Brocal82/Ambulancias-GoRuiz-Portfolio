import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { ApiError } from "../services/http";
import {
  acknowledgeDocumentDelivery,
  getMyDocumentDeliveries,
  markDocumentDeliveryAsRead,
  WorkerDocumentDelivery,
} from "../services/documents";
import { getMyPayrollDocuments, WorkerPayrollDocument } from "../services/payroll";
import { downloadAndOpenAuthenticatedFile } from "../services/secureFiles";
import { resolveInitialDocumentsTab, type DocumentsTabKey } from "../utils/documentsTab";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-ES");
}

function formatPeriod(year?: number, month?: number): string {
  if (!year || !month) return "—";
  return `${String(month).padStart(2, "0")}/${year}`;
}

function getAcknowledgeErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "No se pudo confirmar la recepción.";
  }

  if (error.status === 401) {
    return "Email o contraseña incorrectos.";
  }

  if (error.status === 409) {
    return "Debes abrir primero el documento para poder confirmar su recepción.";
  }

  if (error.status === 400) {
    return error.message || "No se puede confirmar este documento.";
  }

  return error.message || "No se pudo confirmar la recepción.";
}

export function WorkerDocumentsScreen({
  hasCompanyDocumentsModule = true,
  hasPayrollModule = true,
  wsTrigger,
}: {
  hasCompanyDocumentsModule?: boolean;
  hasPayrollModule?: boolean;
  wsTrigger?: number;
}) {
  const [activeTab, setActiveTab] = useState<DocumentsTabKey>(() =>
    resolveInitialDocumentsTab(hasPayrollModule, hasCompanyDocumentsModule),
  );
  const [payrollDocs, setPayrollDocs] = useState<WorkerPayrollDocument[]>([]);
  const [pendingDeliveries, setPendingDeliveries] = useState<WorkerDocumentDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [ackModalDelivery, setAckModalDelivery] = useState<WorkerDocumentDelivery | null>(null);
  const [ackPassword, setAckPassword] = useState("");
  const [isSubmittingAck, setIsSubmittingAck] = useState(false);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(undefined);
    try {
      const [payroll, deliveries] = await Promise.all([
        hasPayrollModule ? getMyPayrollDocuments() : Promise.resolve([]),
        hasCompanyDocumentsModule ? getMyDocumentDeliveries() : Promise.resolve([]),
      ]);
      setPayrollDocs(payroll);
      setPendingDeliveries(deliveries);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("No se pudieron cargar los documentos.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [hasCompanyDocumentsModule, hasPayrollModule]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const prevWsTrigger = useRef(wsTrigger);
  useEffect(() => {
    if (wsTrigger === undefined || wsTrigger === prevWsTrigger.current) return;
    prevWsTrigger.current = wsTrigger;
    void loadAll();
  }, [wsTrigger, loadAll]);

  const toConfirmRows = useMemo(
    () => pendingDeliveries.filter((delivery) => delivery.requiresAcknowledgment),
    [pendingDeliveries],
  );

  const informativeRows = useMemo(
    () => pendingDeliveries.filter((delivery) => !delivery.requiresAcknowledgment),
    [pendingDeliveries],
  );

  const openPayroll = async (doc: WorkerPayrollDocument) => {
    setErrorMessage(undefined);
    setOpeningId(`payroll-${doc._id}`);
    try {
      await downloadAndOpenAuthenticatedFile(doc.filename);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo abrir la nomina.");
    } finally {
      setOpeningId(null);
    }
  };

  const openPendingDocument = async (delivery: WorkerDocumentDelivery) => {
    setErrorMessage(undefined);
    setOpeningId(`delivery-${delivery.deliveryId}`);
    try {
      await downloadAndOpenAuthenticatedFile(delivery.filename);
      if (!delivery.readAt) {
        await markDocumentDeliveryAsRead(delivery.deliveryId);
        await loadAll();
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo abrir el documento.",
      );
    } finally {
      setOpeningId(null);
    }
  };

  const openAcknowledgeModal = (delivery: WorkerDocumentDelivery) => {
    setAckModalDelivery(delivery);
    setAckPassword("");
  };

  const closeAcknowledgeModal = () => {
    if (isSubmittingAck) return;
    setAckModalDelivery(null);
    setAckPassword("");
  };

  const submitAcknowledge = async () => {
    if (!ackModalDelivery) return;
    const password = ackPassword.trim();
    if (!password) {
      setErrorMessage("Introduce tu contraseña para confirmar la recepción.");
      return;
    }

    setIsSubmittingAck(true);
    setErrorMessage(undefined);
    try {
      await acknowledgeDocumentDelivery(ackModalDelivery.deliveryId, password);
      closeAcknowledgeModal();
      await loadAll();
    } catch (error) {
      setErrorMessage(getAcknowledgeErrorMessage(error));
    } finally {
      setIsSubmittingAck(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>Documentos</Text>
          <Pressable
            style={({ pressed }) => [styles.iconButtonRound, pressed && styles.iconButtonRoundPressed]}
            onPress={() => { void loadAll(); }}
            accessibilityRole="button"
            accessibilityLabel="Refrescar documentos"
          >
            {({ pressed }) => (
              <Ionicons name="refresh" size={20} color={pressed ? "#f97316" : "#334155"} />
            )}
          </Pressable>
        </View>
        <Text style={styles.subtitle}>Nóminas y documentos con acuse</Text>
      </View>

      <View style={styles.tabRow}>
        {hasPayrollModule ? (
          <Pressable
            style={[styles.tabButton, activeTab === "payroll" && styles.tabButtonActive]}
            onPress={() => setActiveTab("payroll")}
          >
            <Text style={[styles.tabLabel, activeTab === "payroll" && styles.tabLabelActive]}>
              Nominas ({payrollDocs.length})
            </Text>
          </Pressable>
        ) : null}
        {hasCompanyDocumentsModule ? (
          <>
            <Pressable
              style={[styles.tabButton, activeTab === "toConfirm" && styles.tabButtonActive]}
              onPress={() => setActiveTab("toConfirm")}
            >
              <Text style={[styles.tabLabel, activeTab === "toConfirm" && styles.tabLabelActive]}>
                Para confirmar ({toConfirmRows.filter((row) => !row.acknowledgedAt).length})
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabButton, activeTab === "informative" && styles.tabButtonActive]}
              onPress={() => setActiveTab("informative")}
            >
              <Text style={[styles.tabLabel, activeTab === "informative" && styles.tabLabelActive]}>
                Informativos ({informativeRows.length})
              </Text>
            </Pressable>
          </>
        ) : null}
      </View>

      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{errorMessage}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#0f766e" />
          <Text style={styles.centerText}>Cargando documentos...</Text>
        </View>
      ) : activeTab === "payroll" ? (
        payrollDocs.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.centerText}>No tienes nóminas disponibles.</Text>
            <Pressable style={styles.retryButton} onPress={() => void loadAll()}>
              <Text style={styles.retryButtonText}>Actualizar</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {payrollDocs.map((doc) => (
              <View key={doc._id} style={styles.card}>
                <Text style={styles.cardTitle}>{doc.originalName}</Text>
                <Text style={styles.cardMeta}>Periodo: {formatPeriod(doc.year, doc.month)}</Text>
                <Text style={styles.cardMeta}>Fecha: {formatDateTime(doc.createdAt)}</Text>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => {
                    void openPayroll(doc);
                  }}
                  disabled={openingId === `payroll-${doc._id}`}
                >
                  <Text style={styles.primaryButtonText}>
                    {openingId === `payroll-${doc._id}` ? "Abriendo..." : "Abrir nómina"}
                  </Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )
      ) : activeTab === "toConfirm" ? (
        toConfirmRows.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.centerText}>No tienes documentos para confirmar.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {toConfirmRows.map((delivery) => {
              const canAcknowledge = Boolean(delivery.readAt);
              const isAcknowledged = Boolean(delivery.acknowledgedAt);
              return (
                <View key={delivery.deliveryId} style={styles.card}>
                  <Text style={styles.cardTitle}>{delivery.originalName}</Text>
                  <Text style={styles.cardMeta}>Enviado: {formatDateTime(delivery.sentAt)}</Text>
                  <Text style={styles.cardMeta}>
                    Estado:{" "}
                    {isAcknowledged
                      ? "Confirmado"
                      : delivery.readAt
                        ? "Leído"
                        : "Pendiente"}
                  </Text>
                  {!delivery.readAt && !isAcknowledged ? (
                    <Text style={styles.cardMetaHint}>
                      Abre el documento antes de confirmar su recepción.
                    </Text>
                  ) : null}
                  <View style={styles.rowButtons}>
                    <Pressable
                      style={styles.primaryButton}
                      onPress={() => {
                        void openPendingDocument(delivery);
                      }}
                      disabled={openingId === `delivery-${delivery.deliveryId}`}
                    >
                      <Text style={styles.primaryButtonText}>
                        {openingId === `delivery-${delivery.deliveryId}`
                          ? "Abriendo..."
                          : isAcknowledged
                            ? "Ver documento"
                            : "Abrir documento"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.secondaryButton,
                        (!canAcknowledge || isAcknowledged) && styles.secondaryButtonDisabled,
                      ]}
                      disabled={!canAcknowledge || isAcknowledged}
                      onPress={() => openAcknowledgeModal(delivery)}
                    >
                      <Text style={styles.secondaryButtonText}>
                        {isAcknowledged ? "Confirmado" : "Confirmar recepción"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )
      ) : informativeRows.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.centerText}>No tienes documentos informativos.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {informativeRows.map((delivery) => {
            const isRead = Boolean(delivery.readAt);
            return (
              <View key={delivery.deliveryId} style={styles.card}>
                <Text style={styles.cardTitle}>{delivery.originalName}</Text>
                <Text style={styles.cardMeta}>Enviado: {formatDateTime(delivery.sentAt)}</Text>
                <Text style={styles.cardMeta}>Estado: {isRead ? "Leído" : "Pendiente"}</Text>
                <View style={styles.rowButtons}>
                  <Pressable
                    style={styles.primaryButton}
                    onPress={() => {
                      void openPendingDocument(delivery);
                    }}
                    disabled={openingId === `delivery-${delivery.deliveryId}`}
                  >
                    <Text style={styles.primaryButtonText}>
                      {openingId === `delivery-${delivery.deliveryId}`
                        ? "Abriendo..."
                        : "Abrir documento"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal
        visible={Boolean(ackModalDelivery)}
        transparent
        animationType="fade"
        onRequestClose={closeAcknowledgeModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirmar recepción</Text>
            <Text style={styles.modalText}>
              Introduce tu contraseña para confirmar este documento.
            </Text>
            <TextInput
              value={ackPassword}
              onChangeText={setAckPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.modalInput}
              placeholder="Contraseña"
              placeholderTextColor="#94a3b8"
            />
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalCancelButton} onPress={closeAcknowledgeModal}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirmButton}
                onPress={() => {
                  void submitAcknowledge();
                }}
                disabled={isSubmittingAck}
              >
                <Text style={styles.modalConfirmText}>
                  {isSubmittingAck ? "Confirmando..." : "Confirmar"}
                </Text>
              </Pressable>
            </View>
          </View>
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
    gap: 4,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
  },
  iconButtonRound: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonRoundPressed: {
    borderColor: "#f97316",
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tabButtonActive: {
    borderColor: "#0f766e",
    backgroundColor: "#f0fdfa",
  },
  tabLabel: {
    textAlign: "center",
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
  },
  tabLabelActive: {
    color: "#0f766e",
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
    textAlign: "center",
  },
  errorText: {
    color: "#b91c1c",
    textAlign: "center",
  },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  errorBannerText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "600",
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
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
  },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardMeta: {
    fontSize: 12,
    color: "#64748b",
  },
  cardMetaHint: {
    fontSize: 12,
    color: "#92400e",
  },
  rowButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  primaryButton: {
    borderWidth: 1,
    borderColor: "#0f766e",
    borderRadius: 8,
    backgroundColor: "#0f766e",
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#0284c7",
    borderRadius: 8,
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryButtonDisabled: {
    opacity: 0.45,
  },
  secondaryButtonText: {
    color: "#0c4a6e",
    fontSize: 12,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalText: {
    fontSize: 13,
    color: "#475569",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#0f172a",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  modalCancelButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
  },
  modalCancelText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  modalConfirmButton: {
    borderWidth: 1,
    borderColor: "#0f766e",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#0f766e",
  },
  modalConfirmText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
});
