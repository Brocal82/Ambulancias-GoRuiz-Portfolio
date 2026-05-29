import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError } from "../services/http";
import {
  AppointmentItem,
  AppointmentStatus,
  TimeSlot,
  createAppointment,
  deleteMyAppointment,
  getMyAppointments,
  rejectProposal,
  requestCancellation,
  selectSlot,
} from "../services/appointments";

function formatSlotRange(start: string, end: string): string {
  const startDt = new Date(start);
  const endDt = new Date(end);
  const datePart = startDt.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
  const startTime = startDt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const endTime = endDt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return `${datePart}, ${startTime} – ${endTime}`;
}

function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function statusStyle(status: AppointmentStatus) {
  switch (status) {
    case "confirmed":
    case "rescheduled":
      return { text: "#047857", border: "#22c55e" };
    case "proposed":
      return { text: "#1d4ed8", border: "#3b82f6" };
    case "pending":
      return { text: "#a16207", border: "#eab308" };
    case "cancelled":
      return { text: "#b91c1c", border: "#ef4444" };
    case "cancellation_requested":
      return { text: "#c2410c", border: "#f97316" };
    default:
      return { text: "#475569", border: "#cbd5e1" };
  }
}

function statusLabel(status: AppointmentStatus): string {
  switch (status) {
    case "pending":                return "Pendiente";
    case "proposed":               return "Con propuesta";
    case "confirmed":              return "Confirmada";
    case "rescheduled":            return "Reprogramada";
    case "cancelled":              return "Cancelada";
    case "cancellation_requested": return "Cancelación pendiente";
    default:                       return status;
  }
}

const ACTIVE_STATUSES: AppointmentStatus[] = ["pending", "proposed", "cancellation_requested"];
const HISTORY_STATUSES: AppointmentStatus[] = ["confirmed", "rescheduled", "cancelled"];

export function WorkerAppointmentsScreen({ wsTrigger }: { wsTrigger?: number }) {
  const [items, setItems] = useState<AppointmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [createModal, setCreateModal] = useState({ open: false, reason: "", details: "" });

  const [slotModal, setSlotModal] = useState<{
    open: boolean;
    appointmentId: string;
    proposedSlots: TimeSlot[];
    pickedSlot: TimeSlot | null;
    isActing: boolean;
  }>({ open: false, appointmentId: "", proposedSlots: [], pickedSlot: null, isActing: false });

  const [detailModal, setDetailModal] = useState<{ open: boolean; item: AppointmentItem | null }>({
    open: false,
    item: null,
  });

  const [cancelModal, setCancelModal] = useState<{
    open: boolean;
    appointmentId: string;
    message: string;
    isActing: boolean;
  }>({ open: false, appointmentId: "", message: "", isActing: false });

  const loadAll = useCallback(async (silent?: boolean) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(undefined);
    try {
      const list = await getMyAppointments();
      setItems(list);
    } catch (error) {
      if (error instanceof ApiError) setErrorMessage(error.message);
      else setErrorMessage("No se pudieron cargar tus citas.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const prevWsTrigger = useRef(wsTrigger);
  useEffect(() => {
    if (wsTrigger === undefined || wsTrigger === prevWsTrigger.current) return;
    prevWsTrigger.current = wsTrigger;
    void loadAll(true);
  }, [wsTrigger, loadAll]);

  const activeItems = useMemo(
    () => items.filter((i) => ACTIVE_STATUSES.includes(i.status)),
    [items],
  );

  const historyItems = useMemo(
    () => items.filter((i) => HISTORY_STATUSES.includes(i.status)),
    [items],
  );

  const handleCreate = async () => {
    const reason = createModal.reason.trim();
    const details = createModal.details.trim();
    if (!reason) {
      Alert.alert("Campo requerido", "Introduce el motivo de la cita.");
      return;
    }
    if (!details) {
      Alert.alert("Campo requerido", "Añade más detalles sobre la cita.");
      return;
    }
    setIsSubmitting(true);
    try {
      await createAppointment({ reason, details });
      setCreateModal({ open: false, reason: "", details: "" });
      Alert.alert("Solicitud enviada", "Tu solicitud de cita ha sido registrada.");
      await loadAll(true);
    } catch (error) {
      if (error instanceof ApiError) Alert.alert("No se pudo crear", error.message);
      else Alert.alert("No se pudo crear", "Ha ocurrido un error inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (item: AppointmentItem) => {
    Alert.alert("Eliminar cita", "¿Deseas eliminar esta cita cancelada?", [
      { text: "No", style: "cancel" },
      {
        text: "Sí, eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMyAppointment(item._id);
            await loadAll(true);
          } catch (error) {
            if (error instanceof ApiError) Alert.alert("No se pudo eliminar", error.message);
            else Alert.alert("No se pudo eliminar", "Ha ocurrido un error inesperado.");
          }
        },
      },
    ]);
  };

  const handleSubmitCancellation = async () => {
    const message = cancelModal.message.trim();
    if (!message) {
      Alert.alert("Campo requerido", "Indica el motivo de cancelación.");
      return;
    }
    setCancelModal((prev) => ({ ...prev, isActing: true }));
    try {
      await requestCancellation(cancelModal.appointmentId, message);
      setCancelModal({ open: false, appointmentId: "", message: "", isActing: false });
      Alert.alert("Solicitud enviada", "Tu solicitud de cancelación ha sido enviada al administrador.");
      await loadAll(true);
    } catch (error) {
      setCancelModal((prev) => ({ ...prev, isActing: false }));
      if (error instanceof ApiError) Alert.alert("No se pudo cancelar", error.message);
      else Alert.alert("No se pudo cancelar", "Ha ocurrido un error inesperado.");
    }
  };

  const handleSelectSlot = async () => {
    if (!slotModal.pickedSlot) return;
    setSlotModal((prev) => ({ ...prev, isActing: true }));
    try {
      await selectSlot(slotModal.appointmentId, { selectedSlot: slotModal.pickedSlot });
      setSlotModal({ open: false, appointmentId: "", proposedSlots: [], pickedSlot: null, isActing: false });
      Alert.alert("Cita confirmada", "Has confirmado tu cita correctamente.");
      await loadAll(true);
    } catch (error) {
      setSlotModal((prev) => ({ ...prev, isActing: false }));
      if (error instanceof ApiError) Alert.alert("Error", error.message);
      else Alert.alert("Error", "Ha ocurrido un error inesperado.");
    }
  };

  const handleRejectProposal = () => {
    Alert.alert(
      "Rechazar propuesta",
      "¿Deseas rechazar todos los horarios propuestos? La solicitud volverá a estado pendiente.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Sí, rechazar",
          style: "destructive",
          onPress: async () => {
            setSlotModal((prev) => ({ ...prev, isActing: true }));
            try {
              await rejectProposal(slotModal.appointmentId);
              setSlotModal({ open: false, appointmentId: "", proposedSlots: [], pickedSlot: null, isActing: false });
              await loadAll(true);
            } catch (error) {
              setSlotModal((prev) => ({ ...prev, isActing: false }));
              if (error instanceof ApiError) Alert.alert("Error", error.message);
              else Alert.alert("Error", "Ha ocurrido un error inesperado.");
            }
          },
        },
      ],
    );
  };

  const openSlotModal = (item: AppointmentItem) => {
    setSlotModal({
      open: true,
      appointmentId: item._id,
      proposedSlots: item.proposedSlots,
      pickedSlot: null,
      isActing: false,
    });
  };

  const openCancelModal = (item: AppointmentItem) => {
    setCancelModal({ open: true, appointmentId: item._id, message: "", isActing: false });
  };

  const closeCreateModal = () => setCreateModal({ open: false, reason: "", details: "" });
  const closeSlotModal = () =>
    setSlotModal({ open: false, appointmentId: "", proposedSlots: [], pickedSlot: null, isActing: false });
  const closeDetailModal = () => setDetailModal({ open: false, item: null });
  const closeCancelModal = () =>
    setCancelModal({ open: false, appointmentId: "", message: "", isActing: false });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Citas</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [styles.iconButtonRound, pressed && styles.iconButtonRoundPressed]}
            onPress={() => void loadAll(true)}
            disabled={isRefreshing}
            accessibilityRole="button"
            accessibilityLabel="Refrescar citas"
          >
            {({ pressed }) => (
              isRefreshing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="refresh" size={20} color={pressed ? "#f97316" : "#ffffff"} />
              )
            )}
          </Pressable>
          <Pressable
            style={[styles.iconButtonRound, styles.iconButtonTeal]}
            onPress={() => setCreateModal({ open: true, reason: "", details: "" })}
            accessibilityRole="button"
            accessibilityLabel="Nueva solicitud de cita"
          >
            <Ionicons name="add" size={22} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#0f766e" />
          <Text style={styles.centerText}>Cargando citas...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadAll()}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Solicitudes activas */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Solicitudes activas ({activeItems.length})</Text>
            {activeItems.length === 0 ? (
              <Text style={styles.emptyText}>No tienes solicitudes activas.</Text>
            ) : (
              activeItems.map((item) => {
                const tone = statusStyle(item.status);
                const isCancellationRequested = item.status === "cancellation_requested";
                return (
                  <View key={item._id} style={[styles.appointmentItem, { borderColor: tone.border }]}>
                    <View style={styles.itemLeft}>
                      <Text style={styles.itemReason} numberOfLines={1}>{item.reason}</Text>
                      <Text style={styles.itemSubtext}>
                        {isCancellationRequested
                          ? "Cancelación pendiente de aprobación"
                          : item.status === "proposed"
                            ? `${item.proposedSlots.length} horario${item.proposedSlots.length === 1 ? "" : "s"} propuesto${item.proposedSlots.length === 1 ? "" : "s"}`
                            : `Enviada el ${formatCreatedAt(item.createdAt)}`}
                      </Text>
                    </View>
                    <View style={styles.itemActions}>
                      <Pressable
                        style={[styles.iconMiniButton, styles.infoButton]}
                        onPress={() => setDetailModal({ open: true, item })}
                        accessibilityLabel="Ver detalles"
                      >
                        <Ionicons name="eye-outline" size={18} color="#3b82f6" />
                      </Pressable>
                      {item.status === "proposed" ? (
                        <Pressable
                          style={[styles.iconMiniButton, styles.proposeButton]}
                          onPress={() => openSlotModal(item)}
                          accessibilityLabel="Ver horarios propuestos"
                        >
                          <Ionicons name="time-outline" size={18} color="#ffffff" />
                        </Pressable>
                      ) : null}
                      {!isCancellationRequested ? (
                        <Pressable
                          style={[styles.iconMiniButton, styles.cancelButton]}
                          onPress={() => openCancelModal(item)}
                          accessibilityLabel="Solicitar cancelación"
                        >
                          <Ionicons name="close-outline" size={18} color="#ffffff" />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Historial */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Historial ({historyItems.length})</Text>
            {historyItems.length === 0 ? (
              <Text style={styles.emptyText}>No tienes citas en el historial.</Text>
            ) : (
              historyItems.map((item) => {
                const tone = statusStyle(item.status);
                const isCancelled = item.status === "cancelled";
                const slotLabel = item.selectedSlot
                  ? formatSlotRange(item.selectedSlot.start, item.selectedSlot.end)
                  : "Sin horario asignado";
                return (
                  <View key={item._id} style={[styles.appointmentItem, { borderColor: tone.border }]}>
                    <View style={styles.itemLeft}>
                      <Text style={styles.itemReason} numberOfLines={1}>{item.reason}</Text>
                      <Text style={styles.itemSubtext}>{slotLabel}</Text>
                    </View>
                    <View style={styles.itemActions}>
                      <Pressable
                        style={[styles.iconMiniButton, styles.infoButton]}
                        onPress={() => setDetailModal({ open: true, item })}
                        accessibilityLabel="Ver detalles"
                      >
                        <Ionicons name="eye-outline" size={18} color="#3b82f6" />
                      </Pressable>
                      {isCancelled ? (
                        <Pressable
                          style={[styles.iconMiniButton, styles.deleteButton]}
                          onPress={() => handleDelete(item)}
                          accessibilityLabel="Eliminar cita"
                        >
                          <Ionicons name="trash-outline" size={18} color="#ffffff" />
                        </Pressable>
                      ) : (
                        <Pressable
                          style={[styles.iconMiniButton, styles.cancelButton]}
                          onPress={() => openCancelModal(item)}
                          accessibilityLabel="Solicitar cancelación"
                        >
                          <Ionicons name="close-outline" size={18} color="#ffffff" />
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* Modal: Nueva cita */}
      <Modal
        visible={createModal.open}
        transparent
        animationType="fade"
        onRequestClose={closeCreateModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropDismiss} onPress={closeCreateModal} />
          <View style={styles.modalAlignCenter} pointerEvents="box-none">
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nueva solicitud de cita</Text>
                <Pressable
                  onPress={closeCreateModal}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar"
                >
                  <Ionicons name="close" size={24} color="#334155" />
                </Pressable>
              </View>
              <View style={styles.modalBody}>
                <TextInput
                  value={createModal.reason}
                  onChangeText={(v) => setCreateModal((prev) => ({ ...prev, reason: v }))}
                  placeholder="Motivo (ej. revisión médica anual)"
                  placeholderTextColor="#94a3b8"
                  style={styles.modalInput}
                  maxLength={120}
                />
                <TextInput
                  value={createModal.details}
                  onChangeText={(v) => setCreateModal((prev) => ({ ...prev, details: v }))}
                  placeholder="Detalles adicionales..."
                  placeholderTextColor="#94a3b8"
                  style={[styles.modalInput, styles.modalInputMultiline]}
                  multiline
                  textAlignVertical="top"
                  maxLength={5000}
                />
                <Pressable
                  style={[styles.modalSubmitButton, isSubmitting && styles.buttonDisabled]}
                  onPress={() => void handleCreate()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Enviar solicitud</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Selección de horario */}
      <Modal
        visible={slotModal.open}
        transparent
        animationType="fade"
        onRequestClose={closeSlotModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropDismiss} onPress={closeSlotModal} />
          <View style={styles.modalAlignCenter} pointerEvents="box-none">
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Elige un horario</Text>
                <Pressable
                  onPress={closeSlotModal}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar"
                >
                  <Ionicons name="close" size={24} color="#334155" />
                </Pressable>
              </View>
              <View style={styles.modalBody}>
                {slotModal.proposedSlots.map((slot, index) => {
                  const isPicked =
                    slotModal.pickedSlot?.start === slot.start &&
                    slotModal.pickedSlot?.end === slot.end;
                  return (
                    <Pressable
                      key={index}
                      style={[styles.slotOption, isPicked && styles.slotOptionPicked]}
                      onPress={() => setSlotModal((prev) => ({ ...prev, pickedSlot: slot }))}
                    >
                      {isPicked ? (
                        <Ionicons name="checkmark-circle" size={20} color="#0f766e" />
                      ) : (
                        <Ionicons name="ellipse-outline" size={20} color="#94a3b8" />
                      )}
                      <Text style={[styles.slotOptionText, isPicked && styles.slotOptionTextPicked]}>
                        {formatSlotRange(slot.start, slot.end)}
                      </Text>
                    </Pressable>
                  );
                })}
                <View style={styles.slotActions}>
                  <Pressable
                    style={[styles.slotRejectButton, slotModal.isActing && styles.buttonDisabled]}
                    onPress={handleRejectProposal}
                    disabled={slotModal.isActing}
                  >
                    <Text style={styles.slotRejectText}>Rechazar propuesta</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.modalSubmitButton,
                      (!slotModal.pickedSlot || slotModal.isActing) && styles.buttonDisabled,
                    ]}
                    onPress={() => void handleSelectSlot()}
                    disabled={!slotModal.pickedSlot || slotModal.isActing}
                  >
                    {slotModal.isActing ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.modalSubmitText}>Confirmar</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Solicitar cancelación */}
      <Modal
        visible={cancelModal.open}
        transparent
        animationType="fade"
        onRequestClose={closeCancelModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropDismiss} onPress={closeCancelModal} />
          <View style={styles.modalAlignCenter} pointerEvents="box-none">
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Solicitar cancelación</Text>
                <Pressable
                  onPress={closeCancelModal}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar"
                >
                  <Ionicons name="close" size={24} color="#334155" />
                </Pressable>
              </View>
              <View style={styles.modalBody}>
                <Text style={styles.cancelModalInfo}>
                  Indica el motivo de cancelación. El administrador recibirá tu solicitud y deberá aceptarla.
                </Text>
                <TextInput
                  value={cancelModal.message}
                  onChangeText={(v) => setCancelModal((prev) => ({ ...prev, message: v }))}
                  placeholder="Motivo de cancelación..."
                  placeholderTextColor="#94a3b8"
                  style={[styles.modalInput, styles.modalInputMultiline]}
                  multiline
                  textAlignVertical="top"
                  maxLength={1000}
                />
                <Pressable
                  style={[styles.cancelSubmitButton, cancelModal.isActing && styles.buttonDisabled]}
                  onPress={() => void handleSubmitCancellation()}
                  disabled={cancelModal.isActing}
                >
                  {cancelModal.isActing ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Enviar solicitud</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Detalle */}
      <Modal
        visible={detailModal.open}
        transparent
        animationType="fade"
        onRequestClose={closeDetailModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropDismiss} onPress={closeDetailModal} />
          <View style={styles.modalAlignCenter} pointerEvents="box-none">
            <View style={[styles.modalCard, styles.modalCardScroll]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {detailModal.item?.reason ?? "Detalles de la cita"}
                </Text>
                <Pressable
                  onPress={closeDetailModal}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar"
                >
                  <Ionicons name="close" size={24} color="#334155" />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.modalBody}>
                {detailModal.item ? (
                  <>
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Estado</Text>
                      <Text style={[styles.detailValue, { color: statusStyle(detailModal.item.status).text }]}>
                        {statusLabel(detailModal.item.status)}
                      </Text>
                    </View>
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Detalles</Text>
                      <Text style={styles.detailValue}>{detailModal.item.details}</Text>
                    </View>
                    {detailModal.item.cancellationMessage ? (
                      <View style={[styles.detailSection, styles.cancellationMessageBox]}>
                        <Text style={styles.detailLabel}>Motivo de cancelación</Text>
                        <Text style={styles.detailValue}>{detailModal.item.cancellationMessage}</Text>
                      </View>
                    ) : null}
                    {detailModal.item.selectedSlot ? (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailLabel}>Horario asignado</Text>
                        <Text style={styles.detailValue}>
                          {formatSlotRange(
                            detailModal.item.selectedSlot.start,
                            detailModal.item.selectedSlot.end,
                          )}
                        </Text>
                      </View>
                    ) : null}
                    {detailModal.item.proposedSlots.length > 0 ? (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailLabel}>Horarios propuestos</Text>
                        {detailModal.item.proposedSlots.map((slot, i) => (
                          <Text key={i} style={styles.detailValue}>
                            {"• "}{formatSlotRange(slot.start, slot.end)}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Fecha de solicitud</Text>
                      <Text style={styles.detailValue}>{formatCreatedAt(detailModal.item.createdAt)}</Text>
                    </View>
                  </>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  title: { fontSize: 22, fontWeight: "700", color: "#ffffff" },
  headerActions: { flexDirection: "row", gap: 8 },
  iconButtonRound: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonRoundPressed: {
    borderColor: "#f97316",
  },
  iconButtonTeal: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  centerText: { color: "#64748b" },
  errorText: { color: "#b91c1c", textAlign: "center" },
  retryButton: {
    borderWidth: 1,
    borderColor: "#0f766e",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
  },
  retryButtonText: { color: "#0f766e", fontWeight: "700" },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 10 },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  emptyText: { color: "#64748b" },
  appointmentItem: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: "#f8fafc",
  },
  itemLeft: { flex: 1, minWidth: 0, gap: 2 },
  itemReason: { color: "#0f172a", fontWeight: "700", fontSize: 13 },
  itemSubtext: { color: "#64748b", fontSize: 11 },
  itemActions: { flexDirection: "row", gap: 6 },
  iconMiniButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  infoButton: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#3b82f6" },
  proposeButton: { backgroundColor: "#0f766e" },
  cancelButton: { backgroundColor: "#f97316" },
  deleteButton: { backgroundColor: "#dc2626" },
  buttonDisabled: { opacity: 0.35 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.45)" },
  modalBackdropDismiss: { ...StyleSheet.absoluteFillObject },
  modalAlignCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  modalCardScroll: { maxHeight: "80%" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", flex: 1, marginRight: 8 },
  modalBody: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  modalInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    color: "#0f172a",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  modalInputMultiline: { minHeight: 80 },
  modalSubmitButton: {
    alignSelf: "flex-end",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#0f766e",
  },
  modalSubmitText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  cancelSubmitButton: {
    alignSelf: "flex-end",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#f97316",
  },
  cancelModalInfo: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
  },
  slotOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
  },
  slotOptionPicked: { borderColor: "#0f766e", backgroundColor: "#f0fdf4" },
  slotOptionText: { color: "#334155", fontSize: 13, flex: 1 },
  slotOptionTextPicked: { color: "#0f172a", fontWeight: "700" },
  slotActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  slotRejectButton: { paddingHorizontal: 4, paddingVertical: 10 },
  slotRejectText: { color: "#dc2626", fontWeight: "700", fontSize: 13 },
  detailSection: { gap: 3 },
  detailLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: { fontSize: 14, color: "#0f172a", lineHeight: 20 },
  cancellationMessageBox: {
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 8,
    padding: 8,
  },
});
