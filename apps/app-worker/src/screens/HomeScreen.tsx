import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { getMyDocumentDeliveries } from "../services/documents";
import { getMyMessages } from "../services/messages";
import { buildPublicFileCandidates } from "../services/secureFiles";
import {
  getMonthlyPraemienSummary,
  getMyManualDailyEntriesForMonth,
} from "../services/praemien";
import { getAssignedDaysForWorker, type AssignedDay } from "../services/workday";
import { resolveTodayAssignment } from "../utils/workdayAssignment";
import { getMyVacationRequests } from "../services/vacations";
import { getMySickLeaves } from "../services/sickLeaves";
import { AuthUser } from "../types/auth";

function dienstDateKeyFromAssignment(day: AssignedDay | null): string | null {
  if (!day?.date) return null;
  const trimmed = day.date.trim();
  const direct = /^(\d{4}-\d{2}-\d{2})$/.exec(trimmed);
  if (direct) return direct[1] ?? null;
  const iso = /^(\d{4}-\d{2}-\d{2})T/.exec(trimmed);
  if (iso) return iso[1] ?? null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDienstScheduleLine(day: AssignedDay | null): string {
  if (!day) return "—";
  const a = (day.startTime ?? "").trim();
  const b = (day.endTime ?? "").trim();
  if (!a && !b) return "—";
  return `${a || "--:--"} – ${b || "--:--"}`;
}

function formatPraemieLevel(n: number | null, moduleOn: boolean): string {
  if (!moduleOn) return "—";
  if (n === null) return "—";
  if (n >= 10) return "10";
  if (n >= 9) return "9";
  if (n >= 8) return "8";
  if (n >= 7) return "7";
  return "Sin Prämie";
}

function computeManualMonthAverage(entries: Array<{
  workerSubmittedValue: number;
  adminFinalValue: number | null;
  status: string;
}>): number | null {
  if (!entries.length) return null;
  const values = entries
    .map((entry) =>
      entry.status === "approved" && entry.adminFinalValue != null
        ? entry.adminFinalValue
        : entry.workerSubmittedValue,
    )
    .filter((v) => Number.isFinite(v));
  if (!values.length) return null;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function isTodayInRange(startDate: string, endDate: string): boolean {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const todayKey = `${y}-${m}-${d}`;
  // Parse dates via local device timezone so Berlin UTC timestamps map to the correct calendar day.
  const startKey = (() => {
    const dt = new Date(startDate);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  })();
  const endKey = (() => {
    const dt = new Date(endDate);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  })();
  return todayKey >= startKey && todayKey <= endKey;
}

function formatTodayHeaderDate(date: Date): string {
  const weekdayRaw = date.toLocaleDateString("es-ES", { weekday: "long" });
  const weekday = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1);
  const day = date.getDate();
  const month = date.toLocaleDateString("es-ES", { month: "long" });
  const year = date.getFullYear();
  return `${weekday} ${day}-${month}-${year}`;
}

type Props = {
  onLogout: () => void;
  onRefreshProfile: () => Promise<void>;
  onOpenWorkday: () => void;
  onOpenAgenda: () => void;
  onOpenVacations: () => void;
  onOpenSickLeaves: () => void;
  onOpenPraemien: () => void;
  onOpenDocuments: () => void;
  onOpenMessages: () => void;
  onOpenProfile: () => void;
  hasWorkdayModule: boolean;
  hasAgendaModule: boolean;
  hasDocumentsModule: boolean;
  hasMessagesModule: boolean;
  hasVacationModule: boolean;
  hasSickLeavesModule: boolean;
  hasPraemienModule: boolean;
  user: AuthUser;
  showBottomPreview?: boolean;
};

export function HomeScreen({
  onLogout,
  onRefreshProfile,
  onOpenWorkday,
  onOpenAgenda,
  onOpenVacations,
  onOpenSickLeaves,
  onOpenPraemien,
  onOpenDocuments,
  onOpenMessages,
  onOpenProfile,
  hasWorkdayModule,
  hasAgendaModule,
  hasDocumentsModule,
  hasMessagesModule,
  hasVacationModule,
  hasSickLeavesModule,
  hasPraemienModule,
  user,
  showBottomPreview = true,
}: Props) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [documentsToConfirmCount, setDocumentsToConfirmCount] = useState(0);
  const [informativeUnreadCount, setInformativeUnreadCount] = useState(0);
  /** Ancho real del contenedor de módulos (evita desajuste vs. `width` de ventana + safe area). */
  const [modulesGridInnerWidth, setModulesGridInnerWidth] = useState(0);
  const [alertsModalVisible, setAlertsModalVisible] = useState(false);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const moduleLayout = useMemo(() => {
    const cols = isTablet ? 3 : 2;
    const gap = isTablet ? 12 : 10;
    const scrollHorizontalPad = 24 * 2;
    const cardHorizontalPad = 14 * 2;
    const fallbackInner = Math.max(0, width - scrollHorizontalPad - cardHorizontalPad);
    const inner = modulesGridInnerWidth > 0 ? modulesGridInnerWidth : fallbackInner;
    const rawTile = (inner - gap * (cols - 1)) / cols;
    const tileWidth = Math.max(1, Math.floor(rawTile));
    return { cols, gap, tileWidth };
  }, [width, isTablet, modulesGridInnerWidth]);

  const modules = [
    ...(hasWorkdayModule
      ? [{ key: "jornada", title: "Mi jornada", status: "Activo" }]
      : []),
    {
      key: "turnos",
      title: "Mis turnos",
      status: hasAgendaModule ? "Activo" : "No disponible",
    },
    {
      key: "mensajes",
      title: "Mensajes",
      status: hasMessagesModule ? "Activo" : "No disponible",
    },
    {
      key: "documentos",
      title: "Documentos",
      status: hasDocumentsModule ? "Activo" : "No disponible",
    },
    ...(hasVacationModule
      ? [{ key: "ausencias", title: "Vacaciones/Ausencias", status: "Activo" as const }]
      : []),
    ...(hasSickLeavesModule
      ? [{ key: "bajas", title: "Bajas", status: "Activo" as const }]
      : []),
    { key: "perfil", title: "Mi perfil", status: "Activo" },
  ];

  const [todayAssignment, setTodayAssignment] = useState<AssignedDay | null>(null);
  const [praemieAveragePatients, setPraemieAveragePatients] = useState<number | null>(null);
  const [todayIsOnVacation, setTodayIsOnVacation] = useState(false);
  const [todayIsOnSickLeave, setTodayIsOnSickLeave] = useState(false);

  const loadDienstAndPraemie = useCallback(async () => {
    try {
      const days = await getAssignedDaysForWorker(user._id);
      setTodayAssignment(resolveTodayAssignment(days));
    } catch {
      setTodayAssignment(null);
    }
    if (!hasPraemienModule) {
      setPraemieAveragePatients(null);
      return;
    }
    try {
      const now = new Date();
      const [summary, entries] = await Promise.all([
        getMonthlyPraemienSummary(),
        getMyManualDailyEntriesForMonth(now.getFullYear(), now.getMonth() + 1).catch(() => []),
      ]);
      const manualAverage = computeManualMonthAverage(entries);
      if (manualAverage != null) {
        // In manual workflow, month entries are the source of truth for worker progress.
        setPraemieAveragePatients(manualAverage);
      } else if (
        typeof summary.averagePatients === "number" &&
        Number.isFinite(summary.averagePatients)
      ) {
        setPraemieAveragePatients(summary.averagePatients);
      } else {
        setPraemieAveragePatients(null);
      }
    } catch {
      try {
        const now = new Date();
        const entries = await getMyManualDailyEntriesForMonth(
          now.getFullYear(),
          now.getMonth() + 1,
        );
        setPraemieAveragePatients(computeManualMonthAverage(entries));
      } catch {
        setPraemieAveragePatients(null);
      }
    }
    if (hasVacationModule) {
      try {
        const vacations = await getMyVacationRequests();
        setTodayIsOnVacation(
          vacations.some((v) => v.status === "accepted" && isTodayInRange(v.startDate, v.endDate)),
        );
      } catch {
        setTodayIsOnVacation(false);
      }
    } else {
      setTodayIsOnVacation(false);
    }

    if (hasSickLeavesModule) {
      try {
        const sickLeaves = await getMySickLeaves();
        setTodayIsOnSickLeave(
          sickLeaves.some(
            (s) =>
              (s.status === "accepted" || s.status === "pending") &&
              isTodayInRange(s.startDate, s.endDate),
          ),
        );
      } catch {
        setTodayIsOnSickLeave(false);
      }
    } else {
      setTodayIsOnSickLeave(false);
    }
  }, [hasPraemienModule, hasVacationModule, hasSickLeavesModule, user._id]);

  const refreshAlerts = useCallback(async () => {
    try {
      const [unreadMessages, deliveries] = await Promise.all([
        hasMessagesModule ? getMyMessages({ unreadOnly: true }) : Promise.resolve([]),
        hasDocumentsModule ? getMyDocumentDeliveries() : Promise.resolve([]),
      ]);

      const documentsToConfirm = deliveries.filter(
        (item) => item.requiresAcknowledgment && !item.acknowledgedAt,
      ).length;
      const informativeUnread = deliveries.filter(
        (item) => !item.requiresAcknowledgment && !item.readAt,
      ).length;

      setUnreadMessagesCount(unreadMessages.length);
      setDocumentsToConfirmCount(documentsToConfirm);
      setInformativeUnreadCount(informativeUnread);
    } catch {
      // Keep previous alerts value on transient failures.
    }
  }, [hasDocumentsModule, hasMessagesModule]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onRefreshProfile();
      await Promise.all([refreshAlerts(), loadDienstAndPraemie()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadDienstAndPraemie, onRefreshProfile, refreshAlerts]);

  useEffect(() => {
    void refreshAlerts();
  }, [refreshAlerts]);

  useEffect(() => {
    void loadDienstAndPraemie();
  }, [loadDienstAndPraemie]);

  const pscheinExpiryDate = user.pscheinExpiry ? new Date(user.pscheinExpiry) : null;
  const displayName = `${user.name ?? ""} ${user.lastName ?? ""}`.trim() || "Usuario";
  const employeeNumber = (user.employeeNumber ?? "").trim();
  const profileImageUrl = user.profileImage?.trim()
    ? (buildPublicFileCandidates(user.profileImage.trim())[0] ?? user.profileImage.trim())
    : null;
  const initials = `${(user.name ?? "").trim().charAt(0)}${(user.lastName ?? "").trim().charAt(0)}`
    .toUpperCase()
    .trim() || "U";
  const hasValidPscheinDate =
    pscheinExpiryDate !== null && !Number.isNaN(pscheinExpiryDate.getTime());
  const pscheinDaysToExpiry = hasValidPscheinDate
    ? Math.ceil((pscheinExpiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const hasPscheinAlert =
    pscheinDaysToExpiry !== null && (pscheinDaysToExpiry < 0 || pscheinDaysToExpiry <= 30);
  const pscheinAlertLabel =
    pscheinDaysToExpiry === null
      ? null
      : pscheinDaysToExpiry < 0
        ? "P-Schein caducado"
        : `P-Schein caduca en ${pscheinDaysToExpiry} dia${pscheinDaysToExpiry === 1 ? "" : "s"}`;

  const quickSummaryAlertTotal = useMemo(() => {
    const base =
      unreadMessagesCount + documentsToConfirmCount + informativeUnreadCount;
    return base + (hasPscheinAlert ? 1 : 0);
  }, [
    documentsToConfirmCount,
    hasPscheinAlert,
    informativeUnreadCount,
    unreadMessagesCount,
  ]);
  const todayHeaderDate = useMemo(() => formatTodayHeaderDate(new Date()), []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerIdentity}>
          {profileImageUrl ? (
            <Image source={{ uri: profileImageUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{initials}</Text>
            </View>
          )}
          <View style={styles.headerIdentityText}>
            <Text style={styles.subtitle}>{displayName}</Text>
            {employeeNumber.length > 0 ? (
              <Text style={styles.meta}>{employeeNumber}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.iconButtonRound}
            onPress={handleRefresh}
            disabled={isRefreshing}
            accessibilityRole="button"
            accessibilityLabel="Actualizar"
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#0f766e" />
            ) : (
              <Ionicons name="refresh" size={20} color="#0f766e" />
            )}
          </Pressable>
          <Pressable
            style={styles.iconButtonRound}
            onPress={onLogout}
            accessibilityRole="button"
            accessibilityLabel="Salir"
          >
            <Ionicons name="power" size={20} color="#b91c1c" />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Hoy</Text>
            <Text style={styles.cardDate}>{todayHeaderDate}</Text>
          </View>
          <View style={styles.kpiRow}>
            <View style={styles.kpiColumn}>
              <Text style={styles.kpiHeadingOutside}>Dienst</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir agenda semanal"
                onPress={onOpenAgenda}
                style={({ pressed }) => [styles.kpiBox, pressed && styles.kpiBoxPressed]}
              >
                <View style={styles.kpiColumnBody}>
                  {todayAssignment !== null ? (
                    <Text
                      style={styles.kpiDienstTime}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
                      {formatDienstScheduleLine(todayAssignment)}
                    </Text>
                  ) : todayIsOnSickLeave ? (
                    <View style={styles.kpiDienstStatusBox}>
                      <Ionicons name="thermometer-outline" size={26} color="#ef4444" />
                      <Text style={[styles.kpiDienstStatusText, { color: "#ef4444" }]}>Enfermo</Text>
                    </View>
                  ) : todayIsOnVacation ? (
                    <View style={styles.kpiDienstStatusBox}>
                      <Ionicons name="airplane-outline" size={26} color="#0ea5e9" />
                      <Text style={[styles.kpiDienstStatusText, { color: "#0ea5e9" }]}>Vacaciones</Text>
                    </View>
                  ) : (
                    <View style={styles.kpiDienstStatusBox}>
                      <Ionicons name="sunny-outline" size={26} color="#059669" />
                      <Text style={[styles.kpiDienstStatusText, { color: "#059669" }]}>Libre</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            </View>
            <View style={styles.kpiColumn}>
              <Text style={styles.kpiHeadingOutside}>Prämie</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir Prämie"
                onPress={onOpenPraemien}
                style={({ pressed }) => [styles.kpiBox, pressed && styles.kpiBoxPressed]}
              >
                <View style={styles.kpiColumnBody}>
                  <Text
                    style={styles.kpiValue}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.65}
                  >
                    {formatPraemieLevel(praemieAveragePatients, hasPraemienModule)}
                  </Text>
                </View>
              </Pressable>
            </View>
            <View style={styles.kpiColumn}>
              <Text style={styles.kpiHeadingOutside}>Alertas</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ver alertas"
                onPress={() => setAlertsModalVisible(true)}
                style={({ pressed }) => [styles.kpiBox, pressed && styles.kpiBoxPressed]}
              >
                <View style={styles.kpiColumnBody}>
                  <Text
                    style={styles.kpiValue}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.65}
                  >
                    {quickSummaryAlertTotal > 99 ? "99+" : String(quickSummaryAlertTotal)}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Módulos</Text>
          <View
            style={styles.modulesGrid}
            onLayout={(e) => {
              const w = Math.round(e.nativeEvent.layout.width);
              if (w <= 0) return;
              setModulesGridInnerWidth((prev) => (prev === w ? prev : w));
            }}
          >
            {modules.map((module, index) => {
              const isActive = module.status === "Activo";
              const isWorkdayModule = module.key === "jornada";
              const isAgendaModule = module.key === "turnos";
              const isMessagesModule = module.key === "mensajes";
              const isVacationsModule = module.key === "ausencias";
              const isSickLeavesModule = module.key === "bajas";
              const isDocumentsModule = module.key === "documentos";
              const isProfileModule = module.key === "perfil";
              return (
                <Pressable
                  key={module.key}
                  onPress={
                    isWorkdayModule && hasWorkdayModule
                      ? onOpenWorkday
                      : isAgendaModule && hasAgendaModule
                        ? onOpenAgenda
                        : isMessagesModule && hasMessagesModule
                          ? onOpenMessages
                          : isVacationsModule && hasVacationModule
                            ? onOpenVacations
                          : isSickLeavesModule && hasSickLeavesModule
                            ? onOpenSickLeaves
                          : isProfileModule
                            ? onOpenProfile
                      : isDocumentsModule && hasDocumentsModule
                        ? onOpenDocuments
                        : undefined
                  }
                  disabled={
                    isWorkdayModule
                      ? !hasWorkdayModule
                      : isAgendaModule
                        ? !hasAgendaModule
                        : isMessagesModule
                          ? !hasMessagesModule
                          : isVacationsModule
                            ? !hasVacationModule
                          : isSickLeavesModule
                            ? !hasSickLeavesModule
                          : isProfileModule
                            ? false
                      : isDocumentsModule
                        ? !hasDocumentsModule
                        : true
                  }
                  style={[
                    styles.moduleTile,
                    {
                      width: moduleLayout.tileWidth,
                      maxWidth: moduleLayout.tileWidth,
                      flexGrow: 0,
                      flexShrink: 0,
                      alignSelf: "flex-start",
                      marginRight: (index + 1) % moduleLayout.cols === 0 ? 0 : moduleLayout.gap,
                      marginBottom: moduleLayout.gap,
                    },
                  ]}
                >
                  <Text style={styles.moduleTitle}>{module.title}</Text>
                  <Text style={[styles.moduleStatus, isActive && styles.moduleStatusActive]}>
                    {module.status}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {showBottomPreview ? (
        <View style={styles.bottomNavPreview}>
          <Text style={styles.bottomNavItemActive}>Inicio</Text>
          <Text style={styles.bottomNavItem}>Agenda</Text>
          <Text style={styles.bottomNavItem}>Mensajes</Text>
          <Text style={styles.bottomNavItem}>Perfil</Text>
        </View>
      ) : null}

      <Modal
        visible={alertsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAlertsModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropDismiss} onPress={() => setAlertsModalVisible(false)} />
          <View style={styles.modalAlignCenter} pointerEvents="box-none">
            <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Alertas</Text>
              <Pressable
                onPress={() => setAlertsModalVisible(false)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Ionicons name="close" size={26} color="#334155" />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {hasMessagesModule && unreadMessagesCount > 0 ? (
                <Pressable
                  style={styles.alertRow}
                  onPress={() => {
                    setAlertsModalVisible(false);
                    onOpenMessages();
                  }}
                >
                  <Text style={styles.alertText}>
                    Tienes {unreadMessagesCount} mensaje{unreadMessagesCount === 1 ? "" : "s"} no
                    leído{unreadMessagesCount === 1 ? "" : "s"}
                  </Text>
                  <Text style={styles.alertLink}>Ir a Mensajes</Text>
                </Pressable>
              ) : null}

              {hasDocumentsModule && documentsToConfirmCount > 0 ? (
                <Pressable
                  style={styles.alertRow}
                  onPress={() => {
                    setAlertsModalVisible(false);
                    onOpenDocuments();
                  }}
                >
                  <Text style={styles.alertText}>
                    Tienes {documentsToConfirmCount} documento
                    {documentsToConfirmCount === 1 ? "" : "s"} pendiente
                    {documentsToConfirmCount === 1 ? "" : "s"} de confirmación
                  </Text>
                  <Text style={styles.alertLink}>Ir a Documentos</Text>
                </Pressable>
              ) : null}

              {hasDocumentsModule && informativeUnreadCount > 0 ? (
                <Pressable
                  style={styles.alertRow}
                  onPress={() => {
                    setAlertsModalVisible(false);
                    onOpenDocuments();
                  }}
                >
                  <Text style={styles.alertText}>
                    Tienes {informativeUnreadCount} documento{informativeUnreadCount === 1 ? "" : "s"}{" "}
                    informativo{informativeUnreadCount === 1 ? "" : "s"} sin leer
                  </Text>
                  <Text style={styles.alertLink}>Ir a Documentos</Text>
                </Pressable>
              ) : null}

              {hasPscheinAlert && pscheinAlertLabel ? (
                <Pressable
                  style={styles.alertRow}
                  onPress={() => {
                    setAlertsModalVisible(false);
                    onOpenProfile();
                  }}
                >
                  <Text style={styles.alertText}>{pscheinAlertLabel}</Text>
                  <Text style={styles.alertLink}>Ir a Perfil</Text>
                </Pressable>
              ) : null}

              {quickSummaryAlertTotal === 0 ? (
                <Text style={styles.noAlertsText}>Sin alertas activas.</Text>
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
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerIdentity: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  headerIdentityText: {
    minWidth: 0,
    flexShrink: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f1f5f9",
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
  },
  iconButtonRound: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 16,
  },
  subtitle: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "700",
  },
  meta: {
    fontSize: 13,
    color: "#64748b",
  },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardDate: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
    marginBottom: 12,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  kpiColumn: {
    flex: 1,
    minWidth: 0,
  },
  kpiHeadingOutside: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  modalBackdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
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
    maxHeight: "80%",
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
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalScrollContent: {
    padding: 14,
    gap: 10,
    paddingBottom: 24,
  },
  alertRow: {
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 10,
    backgroundColor: "#fffbeb",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  alertText: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: "600",
  },
  alertLink: {
    color: "#0369a1",
    fontSize: 12,
    fontWeight: "700",
  },
  noAlertsText: {
    color: "#64748b",
    fontSize: 12,
  },
  kpiBox: {
    width: "100%",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "stretch",
  },
  kpiBoxPressed: {
    opacity: 0.88,
  },
  kpiColumnBody: {
    width: "100%",
    alignItems: "stretch",
    justifyContent: "center",
    gap: 6,
    minHeight: 48,
  },
  kpiDienstDayDate: {
    width: "100%",
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    textAlign: "center",
  },
  kpiDienstTime: {
    width: "100%",
    fontSize: 19,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
  },
  kpiDienstStatusBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  kpiDienstStatusText: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  kpiValue: {
    width: "100%",
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
  },
  modulesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
  },
  moduleTile: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    justifyContent: "space-between",
  },
  moduleTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  moduleStatus: {
    fontSize: 12,
    color: "#64748b",
  },
  moduleStatusActive: {
    color: "#0f766e",
    fontWeight: "700",
  },
  bottomNavPreview: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  bottomNavItem: {
    fontSize: 12,
    color: "#64748b",
  },
  bottomNavItemActive: {
    fontSize: 12,
    color: "#0f766e",
    fontWeight: "700",
  },
});
