import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { AuthUser } from "../types/auth";

type Props = {
  onLogout: () => void;
  onRefreshProfile: () => Promise<void>;
  onOpenWorkday: () => void;
  onOpenAgenda: () => void;
  onOpenDocuments: () => void;
  onOpenMessages: () => void;
  onOpenProfile: () => void;
  hasWorkdayModule: boolean;
  hasAgendaModule: boolean;
  hasDocumentsModule: boolean;
  hasMessagesModule: boolean;
  user: AuthUser;
  showBottomPreview?: boolean;
};

export function HomeScreen({
  onLogout,
  onRefreshProfile,
  onOpenWorkday,
  onOpenAgenda,
  onOpenDocuments,
  onOpenMessages,
  onOpenProfile,
  hasWorkdayModule,
  hasAgendaModule,
  hasDocumentsModule,
  hasMessagesModule,
  user,
  showBottomPreview = true,
}: Props) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [alertsCount, setAlertsCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [documentsToConfirmCount, setDocumentsToConfirmCount] = useState(0);
  const [informativeUnreadCount, setInformativeUnreadCount] = useState(0);
  /** Ancho real del contenedor de módulos (evita desajuste vs. `width` de ventana + safe area). */
  const [modulesGridInnerWidth, setModulesGridInnerWidth] = useState(0);
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
    {
      key: "jornada",
      title: "Mi jornada",
      status: hasWorkdayModule ? "Activo" : "No disponible",
    },
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
    { key: "ausencias", title: "Vacaciones/Ausencias", status: "Proximamente" },
    { key: "perfil", title: "Mi perfil", status: "Activo" },
  ];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshProfile();
      await refreshAlerts();
    } finally {
      setIsRefreshing(false);
    }
  };

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
      setAlertsCount(unreadMessages.length + documentsToConfirm + informativeUnread);
    } catch {
      // Keep previous alerts value on transient failures.
    }
  }, [hasDocumentsModule, hasMessagesModule]);

  useEffect(() => {
    void refreshAlerts();
  }, [refreshAlerts]);

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
          <Text style={styles.cardTitle}>Resumen rapido</Text>
          <View style={styles.kpiRow}>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiValue}>08:00</Text>
              <Text style={styles.kpiLabel}>Entrada</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiValue}>17:00</Text>
              <Text style={styles.kpiLabel}>Salida</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiValue}>
                {alertsCount > 99 ? "99+" : String(alertsCount)}
              </Text>
              <Text style={styles.kpiLabel}>Alertas</Text>
            </View>
          </View>
          <View style={styles.alertList}>
            {hasMessagesModule && unreadMessagesCount > 0 ? (
              <Pressable style={styles.alertRow} onPress={onOpenMessages}>
                <Text style={styles.alertText}>
                  Tienes {unreadMessagesCount} mensaje{unreadMessagesCount === 1 ? "" : "s"} no
                  leído{unreadMessagesCount === 1 ? "" : "s"}
                </Text>
                <Text style={styles.alertLink}>Ir a Mensajes</Text>
              </Pressable>
            ) : null}

            {hasDocumentsModule && documentsToConfirmCount > 0 ? (
              <Pressable style={styles.alertRow} onPress={onOpenDocuments}>
                <Text style={styles.alertText}>
                  Tienes {documentsToConfirmCount} documento
                  {documentsToConfirmCount === 1 ? "" : "s"} pendiente
                  {documentsToConfirmCount === 1 ? "" : "s"} de confirmación
                </Text>
                <Text style={styles.alertLink}>Ir a Documentos</Text>
              </Pressable>
            ) : null}

            {hasDocumentsModule && informativeUnreadCount > 0 ? (
              <Pressable style={styles.alertRow} onPress={onOpenDocuments}>
                <Text style={styles.alertText}>
                  Tienes {informativeUnreadCount} documento{informativeUnreadCount === 1 ? "" : "s"}{" "}
                  informativo{informativeUnreadCount === 1 ? "" : "s"} sin leer
                </Text>
                <Text style={styles.alertLink}>Ir a Documentos</Text>
              </Pressable>
            ) : null}

            {hasPscheinAlert && pscheinAlertLabel ? (
              <Pressable style={styles.alertRow} onPress={onOpenProfile}>
                <Text style={styles.alertText}>{pscheinAlertLabel}</Text>
                <Text style={styles.alertLink}>Ir a Perfil</Text>
              </Pressable>
            ) : null}

            {!hasPscheinAlert &&
            unreadMessagesCount === 0 &&
            documentsToConfirmCount === 0 &&
            informativeUnreadCount === 0 ? (
              <Text style={styles.noAlertsText}>Sin alertas activas.</Text>
            ) : null}
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
  kpiRow: {
    flexDirection: "row",
    gap: 10,
  },
  alertList: {
    marginTop: 12,
    gap: 8,
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
  kpiItem: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
  },
  kpiLabel: {
    fontSize: 12,
    color: "#64748b",
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
