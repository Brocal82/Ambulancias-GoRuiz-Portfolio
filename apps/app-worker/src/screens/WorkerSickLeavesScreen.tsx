import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

import { ApiError } from "../services/http";
import {
  attachSickLeaveDocumentFile,
  attachSickLeaveDocumentUrl,
  createSickLeave,
  deleteMyRejectedSickLeave,
  getMySickLeaves,
  SickLeaveFileInput,
  SickLeaveItem,
  SickLeaveStatus,
} from "../services/sickLeaves";
import {
  calendarDateFromApi,
  inclusiveCalendarDayCount,
} from "../utils/calendarDate";

function parseDayKey(day: string): Date | null {
  const normalized = calendarDateFromApi(day);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const [y, m, d] = normalized.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function formatDateLabel(day: string): string {
  const parsed = parseDayKey(day);
  if (!parsed) return day;
  return parsed.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function isPastDay(day: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parsed = parseDayKey(day);
  if (!parsed) return false;
  parsed.setHours(0, 0, 0, 0);
  return parsed.getTime() < today.getTime();
}

function buildDayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getWeekdayMondayIndex(year: number, month: number, day: number): number {
  const jsDay = new Date(year, month - 1, day).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

type CalendarCell = { key: string; day: number; dateKey: string };

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function statusStyle(status: SickLeaveStatus) {
  switch (status) {
    case "accepted": return { text: "#047857", border: "#22c55e" };
    case "pending":  return { text: "#a16207", border: "#eab308" };
    case "rejected": return { text: "#b91c1c", border: "#ef4444" };
    default:         return { text: "#475569", border: "#cbd5e1" };
  }
}


function sortByCreatedDesc(items: SickLeaveItem[]): SickLeaveItem[] {
  return [...items].sort(
    (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
  );
}

export function WorkerSickLeavesScreen({ wsTrigger }: { wsTrigger?: number }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<SickLeaveItem[]>([]);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [note, setNote] = useState("");
  const [pendingDocumentUrl, setPendingDocumentUrl] = useState("");
  const [pendingDocumentFile, setPendingDocumentFile] = useState<SickLeaveFileInput | null>(null);
  const [urlModal, setUrlModal] = useState<{ open: boolean; forId: string | null; draft: string }>({
    open: false,
    forId: null,
    draft: "",
  });
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [adminMessageModal, setAdminMessageModal] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: "", message: "" });

  const loadAll = useCallback(async (silent?: boolean) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(undefined);
    try {
      const list = await getMySickLeaves();
      setItems(sortByCreatedDesc(list));
    } catch (error) {
      if (error instanceof ApiError) setErrorMessage(error.message);
      else setErrorMessage("No se pudieron cargar las bajas.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void loadAll(true);
      }
    });
    return () => subscription.remove();
  }, [loadAll]);

  const prevWsTrigger = useRef(wsTrigger);
  useEffect(() => {
    if (wsTrigger === undefined || wsTrigger === prevWsTrigger.current) return;
    prevWsTrigger.current = wsTrigger;
    void loadAll(true);
  }, [wsTrigger, loadAll]);

  const isInSelectedRange = useCallback(
    (dayKey: string): boolean => {
      if (!selectedStart || !selectedEnd) return false;
      return dayKey >= selectedStart && dayKey <= selectedEnd;
    },
    [selectedEnd, selectedStart],
  );

  const isSelectableDay = useCallback((dayKey: string): boolean => !isPastDay(dayKey), []);

  const selectCalendarDay = useCallback(
    (dayKey: string) => {
      if (!isSelectableDay(dayKey)) {
        Alert.alert("Día no disponible", "No puedes seleccionar días pasados.");
        return;
      }
      if (!selectedStart || (selectedStart && selectedEnd)) {
        setSelectedStart(dayKey);
        setSelectedEnd(null);
        return;
      }
      if (dayKey < selectedStart) {
        setSelectedStart(dayKey);
        setSelectedEnd(null);
        return;
      }
      setSelectedEnd(dayKey);
    },
    [isSelectableDay, selectedEnd, selectedStart],
  );

  const hasSelection = Boolean(selectedStart);

  const selectedRangeLabel = useMemo(() => {
    if (!selectedStart) return "Sin rango seleccionado";
    if (!selectedEnd) return `Inicio: ${formatDateLabel(selectedStart)}`;
    return `${formatDateLabel(selectedStart)} → ${formatDateLabel(selectedEnd)}`;
  }, [selectedEnd, selectedStart]);

  const documentIndicator = useMemo(() => {
    if (pendingDocumentFile) return pendingDocumentFile.name ?? "Imagen seleccionada";
    if (pendingDocumentUrl.trim()) return pendingDocumentUrl.trim();
    return null;
  }, [pendingDocumentFile, pendingDocumentUrl]);

  const handleRemoveRejected = (item: SickLeaveItem) => {
    Alert.alert("Eliminar solicitud", "¿Quieres eliminar esta solicitud rechazada?", [
      { text: "No", style: "cancel" },
      {
        text: "Sí, eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMyRejectedSickLeave(item._id);
            await loadAll(true);
          } catch (error) {
            if (error instanceof ApiError) Alert.alert("No se pudo eliminar", error.message);
            else Alert.alert("No se pudo eliminar", "Ha ocurrido un error inesperado.");
          }
        },
      },
    ]);
  };

  const handleOpenUploadForCreate = () => {
    Alert.alert("Adjuntar documento", "Elige el tipo de adjunto:", [
      {
        text: "URL",
        onPress: () => setUrlModal({ open: true, forId: null, draft: pendingDocumentUrl }),
      },
      {
        text: "Imagen",
        onPress: async () => {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permission.granted) {
            Alert.alert("Permiso requerido", "Necesitas permisos para adjuntar imágenes.");
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            allowsMultipleSelection: false,
            quality: 0.8,
            mediaTypes: ["images"],
          });
          if (!result.canceled && result.assets.length > 0) {
            const asset = result.assets[0]!;
            setPendingDocumentFile({
              uri: asset.uri,
              name: asset.fileName ?? `sick-document-${Date.now()}.jpg`,
              mimeType: asset.mimeType ?? "image/jpeg",
            });
            setPendingDocumentUrl("");
          }
        },
      },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const handleOpenUploadForItem = (id: string) => {
    Alert.alert("Adjuntar documento", "Elige el tipo de adjunto:", [
      {
        text: "URL",
        onPress: () => setUrlModal({ open: true, forId: id, draft: "" }),
      },
      {
        text: "Imagen",
        onPress: async () => {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permission.granted) {
            Alert.alert("Permiso requerido", "Necesitas permisos para adjuntar imágenes.");
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            allowsMultipleSelection: false,
            quality: 0.8,
            mediaTypes: ["images"],
          });
          if (!result.canceled && result.assets.length > 0) {
            const asset = result.assets[0]!;
            setUploadingId(id);
            try {
              await attachSickLeaveDocumentFile(id, {
                uri: asset.uri,
                name: asset.fileName ?? `sick-document-${Date.now()}.jpg`,
                mimeType: asset.mimeType ?? "image/jpeg",
              });
              await loadAll(true);
            } catch (error) {
              if (error instanceof ApiError) Alert.alert("No se pudo adjuntar", error.message);
              else Alert.alert("No se pudo adjuntar", "Ha ocurrido un error inesperado.");
            } finally {
              setUploadingId(null);
            }
          }
        },
      },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const handleConfirmUrlModal = async () => {
    const value = urlModal.draft.trim();
    if (!value) {
      Alert.alert("URL requerida", "Introduce una URL válida.");
      return;
    }
    if (urlModal.forId === null) {
      setPendingDocumentUrl(value);
      setPendingDocumentFile(null);
      setUrlModal({ open: false, forId: null, draft: "" });
      return;
    }
    const id = urlModal.forId;
    setUrlModal({ open: false, forId: null, draft: "" });
    setUploadingId(id);
    try {
      await attachSickLeaveDocumentUrl(id, { documentUrl: value });
      await loadAll(true);
    } catch (error) {
      if (error instanceof ApiError) Alert.alert("No se pudo adjuntar", error.message);
      else Alert.alert("No se pudo adjuntar", "Ha ocurrido un error inesperado.");
    } finally {
      setUploadingId(null);
    }
  };

  const validateCreate = (): { ok: true; start: string; end: string } | { ok: false } => {
    const start = selectedStart ? calendarDateFromApi(selectedStart) : "";
    const end = calendarDateFromApi(selectedEnd ?? selectedStart ?? "");
    if (!start || !end) {
      Alert.alert("Datos incompletos", "Selecciona un rango en el calendario.");
      return { ok: false };
    }
    if (start > end) {
      Alert.alert("Rango inválido", "La fecha de inicio no puede ser posterior a la de fin.");
      return { ok: false };
    }
    return { ok: true, start, end };
  };

  const handleCreate = async () => {
    const validated = validateCreate();
    if (!validated.ok) return;
    setIsSubmitting(true);
    try {
      const newItem = await createSickLeave({
        startDate: validated.start,
        endDate: validated.end,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(!pendingDocumentFile && pendingDocumentUrl.trim()
          ? { documentUrl: pendingDocumentUrl.trim() }
          : {}),
      });
      if (pendingDocumentFile) {
        await attachSickLeaveDocumentFile(newItem._id, pendingDocumentFile);
      }
      setSelectedStart(null);
      setSelectedEnd(null);
      setNote("");
      setPendingDocumentUrl("");
      setPendingDocumentFile(null);
      Alert.alert("Solicitud enviada", "Tu solicitud de baja se ha registrado.");
      await loadAll(true);
    } catch (error) {
      if (error instanceof ApiError) Alert.alert("No se pudo crear", error.message);
      else Alert.alert("No se pudo crear", "Ha ocurrido un error inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const calendarCells = useMemo<CalendarCell[]>(() => {
    const totalDays = getDaysInMonth(year, month);
    const leading = getWeekdayMondayIndex(year, month, 1);
    const cells: CalendarCell[] = [];
    for (let i = 0; i < leading; i++) {
      cells.push({ key: `blank-${i}`, day: 0, dateKey: "" });
    }
    for (let day = 1; day <= totalDays; day++) {
      const dateKey = buildDayKey(year, month, day);
      cells.push({ key: dateKey, day, dateKey });
    }
    return cells;
  }, [month, year]);

  const closeUrlModal = () => setUrlModal({ open: false, forId: null, draft: "" });
  const closeAdminModal = () => setAdminMessageModal({ open: false, title: "", message: "" });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Bajas</Text>
        <Pressable
          style={({ pressed }) => [styles.iconButtonRound, pressed && styles.iconButtonRoundPressed]}
          onPress={() => void loadAll(true)}
          disabled={isRefreshing}
          accessibilityRole="button"
          accessibilityLabel="Refrescar bajas"
        >
          {({ pressed }) => (
            isRefreshing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="refresh" size={20} color={pressed ? "#f97316" : "#ffffff"} />
            )
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#0f766e" />
          <Text style={styles.centerText}>Cargando bajas...</Text>
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
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Calendario de solicitud</Text>

            <View style={styles.filtersRow}>
              <View style={styles.filterBlock}>
                <View style={styles.filterControls}>
                  <Pressable
                    style={styles.filterArrowButton}
                    onPress={() => {
                      const nm = month === 1 ? 12 : month - 1;
                      const ny = month === 1 ? year - 1 : year;
                      setMonth(nm);
                      setYear(ny);
                    }}
                  >
                    <Text style={styles.filterArrowText}>{"<"}</Text>
                  </Pressable>
                  <Text style={styles.filterValue} numberOfLines={1}>
                    {MONTH_NAMES[month - 1]}
                  </Text>
                  <Pressable
                    style={styles.filterArrowButton}
                    onPress={() => {
                      const nm = month === 12 ? 1 : month + 1;
                      const ny = month === 12 ? year + 1 : year;
                      setMonth(nm);
                      setYear(ny);
                    }}
                  >
                    <Text style={styles.filterArrowText}>{">"}</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.filterBlock}>
                <View style={styles.filterControls}>
                  <Pressable
                    style={styles.filterArrowButton}
                    onPress={() => setYear((prev) => prev - 1)}
                  >
                    <Text style={styles.filterArrowText}>{"<"}</Text>
                  </Pressable>
                  <Text style={styles.filterValue} numberOfLines={1}>{year}</Text>
                  <Pressable
                    style={styles.filterArrowButton}
                    onPress={() => setYear((prev) => prev + 1)}
                  >
                    <Text style={styles.filterArrowText}>{">"}</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.monthNav}>
              <Pressable
                style={styles.monthArrowButton}
                onPress={() => {
                  const nm = month === 1 ? 12 : month - 1;
                  const ny = month === 1 ? year - 1 : year;
                  setMonth(nm);
                  setYear(ny);
                }}
              >
                <Text style={styles.monthArrowText}>{"<"}</Text>
              </Pressable>
              <Text style={styles.monthLabel}>
                {String(month).padStart(2, "0")}/{year}
                {isRefreshing ? "..." : ""}
              </Text>
              <Pressable
                style={styles.monthArrowButton}
                onPress={() => {
                  const nm = month === 12 ? 1 : month + 1;
                  const ny = month === 12 ? year + 1 : year;
                  setMonth(nm);
                  setYear(ny);
                }}
              >
                <Text style={styles.monthArrowText}>{">"}</Text>
              </Pressable>
            </View>

            <View style={styles.weekHeader}>
              {["L", "M", "X", "J", "V", "S", "D"].map((w) => (
                <Text key={w} style={styles.weekHeaderText}>{w}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarCells.map((cell) => {
                if (cell.day === 0) {
                  return <View key={cell.key} style={styles.calendarCellBlank} />;
                }
                const isBlocked = !isSelectableDay(cell.dateKey);
                const isStart = selectedStart === cell.dateKey;
                const isEnd = selectedEnd === cell.dateKey;
                const inRange = isInSelectedRange(cell.dateKey);
                return (
                  <Pressable
                    key={cell.key}
                    style={styles.calendarCell}
                    onPress={() => selectCalendarDay(cell.dateKey)}
                  >
                    <View
                      style={[
                        styles.calendarCellInner,
                        styles.dayNeutral,
                        inRange && styles.dayInRange,
                        (isStart || isEnd) && styles.dayEdge,
                        isBlocked && styles.dayBlocked,
                      ]}
                    >
                      <Text style={styles.calendarCellText}>{cell.day}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.rangeLabel}>{selectedRangeLabel}</Text>

            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Nota (opcional)"
              placeholderTextColor="#94a3b8"
              style={[styles.noteInput]}
              multiline
              textAlignVertical="top"
            />

            {documentIndicator ? (
              <View style={styles.docIndicatorRow}>
                <Ionicons name="attach-outline" size={14} color="#047857" />
                <Text style={styles.docIndicatorText} numberOfLines={1}>
                  {documentIndicator}
                </Text>
                <Pressable
                  onPress={() => {
                    setPendingDocumentUrl("");
                    setPendingDocumentFile(null);
                  }}
                  hitSlop={8}
                  accessibilityLabel="Eliminar documento adjunto"
                >
                  <Ionicons name="close-circle" size={16} color="#94a3b8" />
                </Pressable>
              </View>
            ) : null}

            <View style={styles.calendarActionRow}>
              <Pressable
                style={styles.iconActionButton}
                onPress={handleOpenUploadForCreate}
                accessibilityRole="button"
                accessibilityLabel="Adjuntar documento"
              >
                <Ionicons name="attach-outline" size={20} color="#ffffff" />
              </Pressable>
              <Pressable
                style={[
                  styles.iconActionButton,
                  styles.submitIconButton,
                  (!hasSelection || isSubmitting) && styles.iconActionButtonDisabled,
                ]}
                onPress={() => void handleCreate()}
                disabled={isSubmitting || !hasSelection}
                accessibilityRole="button"
                accessibilityLabel="Crear solicitud de baja"
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Ionicons name="send-outline" size={20} color="#ffffff" />
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Solicitudes ({items.length})</Text>
            {items.length === 0 ? (
              <Text style={styles.emptyText}>Todavía no tienes solicitudes de baja.</Text>
            ) : (
              items.map((item) => {
                const start = calendarDateFromApi(item.startDate);
                const end = calendarDateFromApi(item.endDate);
                const days = inclusiveCalendarDayCount(start, end);
                const tone = statusStyle(item.status);
                const hasNote = Boolean(item.note?.trim());
                const loadingThis = uploadingId === item._id;
                const canDeleteRejected = item.status === "rejected";
                const docCount = (item.documents?.length ?? 0) > 0
                  ? (item.documents?.length ?? 0)
                  : item.documentUrl ? 1 : 0;

                return (
                  <View
                    key={item._id}
                    style={[styles.requestItem, { borderColor: tone.border }]}
                  >
                    <Text style={styles.requestRangeCompact} numberOfLines={1}>
                      {formatDateLabel(start)} - {formatDateLabel(end)}
                    </Text>
                    <Text style={styles.daysBadgeText}>{days}d</Text>
                    <Text style={styles.docCountText}>{docCount > 0 ? `${docCount} Doc` : ""}</Text>
                    <View style={styles.requestCompactRight}>
                      {hasNote ? (
                        <Pressable
                          style={[styles.iconMiniButton, styles.messageButton]}
                          onPress={() =>
                            setAdminMessageModal({
                              open: true,
                              title: "Nota de la solicitud",
                              message: item.note?.trim() ?? "",
                            })
                          }
                          accessibilityLabel="Ver nota"
                        >
                          <Ionicons name="mail-outline" size={16} color="#ffffff" />
                        </Pressable>
                      ) : null}
                      <Pressable
                        style={[
                          styles.iconMiniButton,
                          styles.attachMiniButton,
                          loadingThis && styles.buttonDisabled,
                        ]}
                        onPress={() => handleOpenUploadForItem(item._id)}
                        disabled={loadingThis}
                        accessibilityLabel="Adjuntar documento"
                      >
                        {loadingThis ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Ionicons name="attach-outline" size={16} color="#ffffff" />
                        )}
                      </Pressable>
                      {canDeleteRejected ? (
                        <Pressable
                          style={[styles.iconMiniButton, styles.rejectButton]}
                          onPress={() => handleRemoveRejected(item)}
                          accessibilityLabel="Eliminar solicitud rechazada"
                        >
                          <Ionicons name="trash-outline" size={16} color="#ffffff" />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      <Modal
        visible={urlModal.open}
        transparent
        animationType="fade"
        onRequestClose={closeUrlModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropDismiss} onPress={closeUrlModal} />
          <View style={styles.modalAlignCenter} pointerEvents="box-none">
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Adjuntar URL</Text>
                <Pressable
                  onPress={closeUrlModal}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar"
                >
                  <Ionicons name="close" size={24} color="#334155" />
                </Pressable>
              </View>
              <View style={styles.modalBody}>
                <TextInput
                  value={urlModal.draft}
                  onChangeText={(v) => setUrlModal((prev) => ({ ...prev, draft: v }))}
                  placeholder="https://..."
                  placeholderTextColor="#94a3b8"
                  style={styles.modalInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
                <Pressable
                  style={styles.modalSubmitButton}
                  onPress={() => void handleConfirmUrlModal()}
                >
                  <Text style={styles.modalSubmitText}>Adjuntar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={adminMessageModal.open}
        transparent
        animationType="fade"
        onRequestClose={closeAdminModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropDismiss} onPress={closeAdminModal} />
          <View style={styles.modalAlignCenter} pointerEvents="box-none">
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{adminMessageModal.title}</Text>
                <Pressable
                  onPress={closeAdminModal}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar mensaje"
                >
                  <Ionicons name="close" size={24} color="#334155" />
                </Pressable>
              </View>
              <View style={styles.modalBody}>
                <Text style={styles.modalMessageText}>{adminMessageModal.message}</Text>
              </View>
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
  filtersRow: { marginTop: 4, marginBottom: 8, flexDirection: "row", gap: 10 },
  filterBlock: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  filterControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  filterArrowButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  filterArrowText: { color: "#334155", fontWeight: "700", fontSize: 14 },
  filterValue: {
    flex: 1,
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 14,
    textAlign: "center",
  },
  monthNav: {
    marginTop: 6,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthLabel: { color: "#0f172a", fontSize: 18, fontWeight: "700" },
  monthArrowButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  monthArrowText: { color: "#334155", fontWeight: "700", fontSize: 16 },
  weekHeader: { marginTop: 4, flexDirection: "row", justifyContent: "space-between" },
  weekHeaderText: {
    width: `${100 / 7}%`,
    textAlign: "center",
    color: "#475569",
    fontWeight: "700",
    fontSize: 12,
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  calendarCellBlank: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  calendarCell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  calendarCellInner: {
    flex: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  calendarCellText: { fontSize: 12, fontWeight: "700", color: "#0f172a" },
  dayNeutral: { backgroundColor: "#f1f5f9", borderColor: "#cbd5e1" },
  dayBlocked: { opacity: 0.38 },
  dayInRange: { borderColor: "#0ea5e9", borderWidth: 2 },
  dayEdge: { backgroundColor: "#0ea5e9" },
  rangeLabel: {
    marginTop: 2,
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
    textAlign: "center",
  },
  noteInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    color: "#0f172a",
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 60,
    fontSize: 13,
  },
  docIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  docIndicatorText: {
    flex: 1,
    fontSize: 12,
    color: "#047857",
    fontWeight: "600",
  },
  calendarActionRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#334155",
  },
  submitIconButton: { backgroundColor: "#0f766e" },
  iconActionButtonDisabled: { opacity: 0.35 },
  emptyText: { color: "#64748b" },
  requestItem: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: "#f8fafc",
  },
  requestRangeCompact: { flex: 1, color: "#0f172a", fontWeight: "700", fontSize: 11 },
  daysBadgeText: { width: 32, textAlign: "center", color: "#dc2626", fontSize: 11, fontWeight: "700" },
  docCountText: { width: 40, textAlign: "center", color: "#0ea5e9", fontSize: 10, fontWeight: "600" },
  requestCompactRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  iconMiniButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  messageButton: { backgroundColor: "#0f766e" },
  attachMiniButton: { backgroundColor: "#334155" },
  rejectButton: { backgroundColor: "#dc2626" },
  buttonDisabled: { opacity: 0.5 },
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
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
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
  modalSubmitButton: {
    alignSelf: "flex-end",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#0f766e",
  },
  modalSubmitText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  modalMessageText: { color: "#334155", fontSize: 14, lineHeight: 20 },
});
