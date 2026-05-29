import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import * as Notifications from "expo-notifications";
import { ENV } from "../config/env";
import { getAuthBearerToken } from "../services/http";

import { AuthUser, CompanyModuleKey, MODULE_KEYS, ScheduleSource } from "../types/auth";
import { getMyMessages } from "../services/messages";
import { HomeScreen } from "./HomeScreen";
import { WorkerWorkdayScreen } from "./WorkerWorkdayScreen";
import { WorkerAgendaScreen } from "./WorkerAgendaScreen";
import { WorkerDocumentsScreen } from "./WorkerDocumentsScreen";
import { WorkerMessagesScreen } from "./WorkerMessagesScreen";
import { WorkerProfileScreen } from "./WorkerProfileScreen";
import { WorkerWorkdayClosureScreen } from "./WorkerWorkdayClosureScreen";
import { WorkerPraemienScreen } from "./WorkerPraemienScreen";
import { WorkerVacationsScreen } from "./WorkerVacationsScreen";
import { WorkerSickLeavesScreen } from "./WorkerSickLeavesScreen";
import { WorkerAppointmentsScreen } from "./WorkerAppointmentsScreen";
import { resolvePushNavigationTarget } from "../utils/notificationNavigation";

type WorkerTabKey =
  | "home"
  | "workday"
  | "agenda"
  | "vacations"
  | "sickLeaves"
  | "appointments"
  | "praemien"
  | "documents"
  | "messages"
  | "profile";

type Props = {
  user: AuthUser;
  enabledModules: CompanyModuleKey[];
  scheduleSource: ScheduleSource;
  onLogout: () => Promise<void>;
  onRefreshProfile: () => Promise<void>;
};

function PlaceholderScreen({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View style={styles.placeholderContainer}>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderDescription}>{description}</Text>
      <Text style={styles.placeholderBadge}>Proximamente</Text>
    </View>
  );
}

export function WorkerTabsShell({
  user,
  enabledModules,
  scheduleSource,
  onLogout,
  onRefreshProfile,
}: Props) {
  const [activeTab, setActiveTab] = useState<WorkerTabKey>("home");
  const [initialAgendaDate, setInitialAgendaDate] = useState<string | undefined>(undefined);
  /** Pantalla completa de cierre / revision desde el chip "jornada en curso". */
  const [workdayClosureOpen, setWorkdayClosureOpen] = useState(false);

  const notifListenerRef = useRef<Notifications.Subscription | null>(null);
  useEffect(() => {
    notifListenerRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        const target = resolvePushNavigationTarget(data, enabledModules);
        if (!target) return;
        if (target.agendaDate) {
          setInitialAgendaDate(target.agendaDate);
        }
        setActiveTab(target.tab);
      },
    );
    return () => {
      notifListenerRef.current?.remove();
    };
  }, [enabledModules]);
  const hasWorkdayModule = enabledModules.includes(MODULE_KEYS.WORKDAY);
  const hasAgendaModule =
    enabledModules.includes(MODULE_KEYS.SCHEDULING) ||
    enabledModules.includes(MODULE_KEYS.EXCEL_PLANNING);
  const hasMessagesModule = enabledModules.includes(MODULE_KEYS.MESSAGES);
  const hasVacationModule = enabledModules.includes(MODULE_KEYS.VACATION);
  const hasSickLeavesModule = enabledModules.includes(MODULE_KEYS.SICK_LEAVES);
  const hasAppointmentsModule = enabledModules.includes(MODULE_KEYS.APPOINTMENTS);
  const hasCompanyDocumentsModule = enabledModules.includes(MODULE_KEYS.DOCUMENTS);
  const hasPayrollModule = enabledModules.includes(MODULE_KEYS.PAYROLL);
  const hasDocumentsModule = hasCompanyDocumentsModule || hasPayrollModule;
  const hasPraemienModule = enabledModules.includes(MODULE_KEYS.PRAEMIEN);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [wsTrigger, setWsTrigger] = useState(0);
  const [agendaWsTrigger, setAgendaWsTrigger] = useState(0);
  const [workdayWsTrigger, setWorkdayWsTrigger] = useState(0);
  const [vacationWsTrigger, setVacationWsTrigger] = useState(0);
  const [sickLeaveWsTrigger, setSickLeaveWsTrigger] = useState(0);
  const [appointmentWsTrigger, setAppointmentWsTrigger] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const wsReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsReconnectDelayRef = useRef(1000);
  const wsPausedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  const refreshUnreadMessagesCount = useCallback(async () => {
    if (!hasMessagesModule) {
      setUnreadMessagesCount(0);
      await Notifications.setBadgeCountAsync(0);
      return;
    }

    try {
      const unread = await getMyMessages({ unreadOnly: true });
      setUnreadMessagesCount(unread.length);
      await Notifications.setBadgeCountAsync(unread.length);
    } catch {
      // keep previous value to avoid badge flickering on transient failures
    }
  }, [hasMessagesModule]);

  useEffect(() => {
    void refreshUnreadMessagesCount();
    const intervalId = setInterval(() => {
      void refreshUnreadMessagesCount();
    }, 20000);
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void refreshUnreadMessagesCount();
      }
    });
    return () => {
      clearInterval(intervalId);
      appStateSubscription.remove();
    };
  }, [refreshUnreadMessagesCount]);

  const hasRealtimeModule =
    hasMessagesModule ||
    hasAgendaModule ||
    hasWorkdayModule ||
    hasVacationModule ||
    hasSickLeavesModule ||
    hasAppointmentsModule;

  useEffect(() => {
    if (!hasRealtimeModule) {
      wsRef.current?.close();
      if (wsReconnectTimerRef.current) {
        clearTimeout(wsReconnectTimerRef.current);
        wsReconnectTimerRef.current = null;
      }
      return;
    }

    let active = true;

    const clearReconnectTimer = () => {
      if (wsReconnectTimerRef.current) {
        clearTimeout(wsReconnectTimerRef.current);
        wsReconnectTimerRef.current = null;
      }
    };

    const closeSocket = () => {
      wsRef.current?.close();
      wsRef.current = null;
    };

    const scheduleReconnect = () => {
      if (!active || wsPausedRef.current) return;
      clearReconnectTimer();
      const delay = wsReconnectDelayRef.current;
      wsReconnectDelayRef.current = Math.min(delay * 2, 30000);
      wsReconnectTimerRef.current = setTimeout(() => {
        if (active && !wsPausedRef.current) void connect();
      }, delay);
    };

    const connect = async () => {
      if (!active || wsPausedRef.current) return;
      const token = await getAuthBearerToken();
      if (!active || !token || wsPausedRef.current) return;

      closeSocket();
      const ws = new WebSocket(`${ENV.wsBaseUrl}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        wsReconnectDelayRef.current = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as { event?: string };
          if (msg.event === "new_message") {
            void refreshUnreadMessagesCount();
            setWsTrigger((prev) => prev + 1);
          } else if (msg.event === "agenda_changed" || msg.event === "dienst_changed") {
            setAgendaWsTrigger((prev) => prev + 1);
          } else if (msg.event === "workday_summary_changed") {
            setWorkdayWsTrigger((prev) => prev + 1);
          } else if (msg.event === "vacation_request_changed" && hasVacationModule) {
            setVacationWsTrigger((prev) => prev + 1);
          } else if (msg.event === "sick_leave_changed" && hasSickLeavesModule) {
            setSickLeaveWsTrigger((prev) => prev + 1);
          } else if (msg.event === "appointment_changed" && hasAppointmentsModule) {
            setAppointmentWsTrigger((prev) => prev + 1);
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!active || wsPausedRef.current) return;
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    void connect();

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      appStateRef.current = nextState;
      const isBackground = nextState === "background" || nextState === "inactive";
      if (isBackground) {
        wsPausedRef.current = true;
        clearReconnectTimer();
        closeSocket();
        return;
      }
      if (nextState === "active" && wsPausedRef.current) {
        wsPausedRef.current = false;
        wsReconnectDelayRef.current = 1000;
        void connect();
        void refreshUnreadMessagesCount();
      }
    });

    return () => {
      active = false;
      wsPausedRef.current = false;
      clearReconnectTimer();
      closeSocket();
      appStateSubscription.remove();
    };
  }, [
    hasRealtimeModule,
    hasVacationModule,
    hasSickLeavesModule,
    hasAppointmentsModule,
    refreshUnreadMessagesCount,
  ]);

  const content = useMemo(() => {
    switch (activeTab) {
      case "home":
        return (
          <HomeScreen
            user={user}
            onLogout={onLogout}
            onRefreshProfile={onRefreshProfile}
            onOpenWorkday={() => setActiveTab("workday")}
            onOpenAgenda={() => setActiveTab("agenda")}
            onOpenVacations={() => setActiveTab("vacations")}
            onOpenSickLeaves={() => setActiveTab("sickLeaves")}
            onOpenAppointments={() => setActiveTab("appointments")}
            onOpenPraemien={() => setActiveTab("praemien")}
            onOpenDocuments={() => setActiveTab("documents")}
            onOpenMessages={() => setActiveTab("messages")}
            onOpenProfile={() => setActiveTab("profile")}
            hasWorkdayModule={hasWorkdayModule}
            hasAgendaModule={hasAgendaModule}
            hasVacationModule={hasVacationModule}
            hasSickLeavesModule={hasSickLeavesModule}
            hasAppointmentsModule={hasAppointmentsModule}
            hasDocumentsModule={hasDocumentsModule}
            hasCompanyDocumentsModule={hasCompanyDocumentsModule}
            hasPayrollModule={hasPayrollModule}
            hasMessagesModule={hasMessagesModule}
            hasPraemienModule={hasPraemienModule}
            agendaWsTrigger={agendaWsTrigger}
            showBottomPreview={false}
          />
        );
      case "workday":
        return hasWorkdayModule ? (
          <WorkerWorkdayScreen
            user={user}
            enabledModules={enabledModules}
            onOpenWorkdayClosure={() => setWorkdayClosureOpen(true)}
            workdayWsTrigger={workdayWsTrigger}
            agendaWsTrigger={agendaWsTrigger}
          />
        ) : (
          <PlaceholderScreen
            title="Mi Jornada"
            description="Tu empresa no tiene el modulo Jornada activo."
          />
        );
      case "agenda":
        return (
          <WorkerAgendaScreen
            user={user}
            scheduleSource={scheduleSource}
            hasVacationModule={hasVacationModule}
            hasSickLeavesModule={hasSickLeavesModule}
            initialDate={initialAgendaDate}
            agendaWsTrigger={agendaWsTrigger}
          />
        );
      case "vacations":
        return hasVacationModule ? (
          <WorkerVacationsScreen wsTrigger={vacationWsTrigger} />
        ) : (
          <PlaceholderScreen
            title="Vacaciones y ausencias"
            description="Tu empresa no tiene el modulo Vacaciones activo."
          />
        );
      case "sickLeaves":
        return hasSickLeavesModule ? (
          <WorkerSickLeavesScreen wsTrigger={sickLeaveWsTrigger} />
        ) : (
          <PlaceholderScreen
            title="Bajas"
            description="Tu empresa no tiene el modulo Bajas activo."
          />
        );
      case "appointments":
        return hasAppointmentsModule ? (
          <WorkerAppointmentsScreen wsTrigger={appointmentWsTrigger} />
        ) : (
          <PlaceholderScreen
            title="Citas"
            description="Tu empresa no tiene el modulo Citas activo."
          />
        );
      case "praemien":
        return <WorkerPraemienScreen hasPraemienModule={hasPraemienModule} userId={user._id} />;
      case "messages":
        return hasMessagesModule ? (
          <WorkerMessagesScreen userId={user._id} wsTrigger={wsTrigger} />
        ) : (
          <PlaceholderScreen
            title="Mensajes"
            description="Tu empresa no tiene el modulo Mensajes activo."
          />
        );
      case "documents":
        return hasDocumentsModule ? (
          <WorkerDocumentsScreen
            hasCompanyDocumentsModule={hasCompanyDocumentsModule}
            hasPayrollModule={hasPayrollModule}
          />
        ) : (
          <PlaceholderScreen
            title="Documentos"
            description="Tu empresa no tiene los modulos Documentos/Nominas activos."
          />
        );
      case "profile":
        return <WorkerProfileScreen user={user} onRefreshProfile={onRefreshProfile} />;
      default:
        return null;
    }
  }, [
    activeTab,
    initialAgendaDate,
    hasWorkdayModule,
    hasAgendaModule,
    hasVacationModule,
    hasSickLeavesModule,
    hasAppointmentsModule,
    hasDocumentsModule,
    hasCompanyDocumentsModule,
    hasPayrollModule,
    hasMessagesModule,
    hasPraemienModule,
    onLogout,
    onRefreshProfile,
    scheduleSource,
    user,
    wsTrigger,
  ]);

  return (
    <View style={styles.root}>
      {workdayClosureOpen ? (
        <WorkerWorkdayClosureScreen
          user={user}
          enabledModules={enabledModules}
          onClose={() => setWorkdayClosureOpen(false)}
        />
      ) : (
        <>
          <View style={styles.content}>{content}</View>
          <View style={styles.bottomNav}>
        <Pressable onPress={() => setActiveTab("home")} style={styles.tabButton}>
          <Ionicons
            name="home-outline"
            size={22}
            color={activeTab === "home" ? "#f97316" : "#ffffff"}
            style={styles.tabIcon}
          />
          <Text style={[styles.tabText, activeTab === "home" && styles.tabTextActive]} numberOfLines={1}>
            Inicio
          </Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab("agenda")} style={styles.tabButton}>
          <Ionicons
            name="calendar-outline"
            size={22}
            color={activeTab === "agenda" ? "#f97316" : "#ffffff"}
            style={styles.tabIcon}
          />
          <Text style={[styles.tabText, activeTab === "agenda" && styles.tabTextActive]} numberOfLines={1}>
            Agenda
          </Text>
        </Pressable>
        {hasWorkdayModule ? (
          <Pressable onPress={() => setActiveTab("workday")} style={styles.tabButton}>
            <Ionicons
              name="today-outline"
              size={22}
              color={activeTab === "workday" ? "#f97316" : "#ffffff"}
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, activeTab === "workday" && styles.tabTextActive]} numberOfLines={1}>
              Mi jornada
            </Text>
          </Pressable>
        ) : null}
        {hasVacationModule ? (
          <Pressable onPress={() => setActiveTab("vacations")} style={styles.tabButton}>
            <Ionicons
              name="airplane-outline"
              size={22}
              color={activeTab === "vacations" ? "#f97316" : "#ffffff"}
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, activeTab === "vacations" && styles.tabTextActive]} numberOfLines={1}>
              Vacaciones
            </Text>
          </Pressable>
        ) : null}
        {hasSickLeavesModule ? (
          <Pressable onPress={() => setActiveTab("sickLeaves")} style={styles.tabButton}>
            <Ionicons
              name="medkit-outline"
              size={22}
              color={activeTab === "sickLeaves" ? "#f97316" : "#ffffff"}
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, activeTab === "sickLeaves" && styles.tabTextActive]} numberOfLines={1}>
              Bajas
            </Text>
          </Pressable>
        ) : null}
        {hasAppointmentsModule ? (
          <Pressable onPress={() => setActiveTab("appointments")} style={styles.tabButton}>
            <Ionicons
              name="clipboard-outline"
              size={22}
              color={activeTab === "appointments" ? "#f97316" : "#ffffff"}
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, activeTab === "appointments" && styles.tabTextActive]} numberOfLines={1}>
              Citas
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => {
            setActiveTab("messages");
            void refreshUnreadMessagesCount();
          }}
          style={styles.tabButton}
        >
          <View style={styles.messagesTabInner}>
            <View style={styles.messagesIconWrap}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={22}
                color={activeTab === "messages" ? "#f97316" : "#ffffff"}
                style={styles.tabIcon}
              />
              {hasMessagesModule && unreadMessagesCount > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.tabText, activeTab === "messages" && styles.tabTextActive]} numberOfLines={1}>
              Mensajes
            </Text>
          </View>
        </Pressable>
        <Pressable onPress={() => setActiveTab("profile")} style={styles.tabButton}>
          <Ionicons
            name="person-circle-outline"
            size={24}
            color={activeTab === "profile" ? "#f97316" : "#ffffff"}
            style={styles.tabIcon}
          />
          <Text style={[styles.tabText, activeTab === "profile" && styles.tabTextActive]} numberOfLines={1}>
            Perfil
          </Text>
        </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    backgroundColor: "#0f172a",
    paddingTop: 6,
    paddingBottom: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 2,
    minWidth: 0,
    paddingHorizontal: 2,
  },
  tabIcon: {
    marginBottom: 0,
  },
  tabText: {
    fontSize: 10,
    color: "#ffffff",
    textAlign: "center",
    maxWidth: "100%",
  },
  tabTextActive: {
    color: "#f97316",
    fontWeight: "700",
  },
  messagesTabInner: {
    alignItems: "center",
    gap: 2,
    minWidth: 0,
    maxWidth: "100%",
  },
  messagesIconWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadge: {
    position: "absolute",
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
  auxRouteRoot: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  auxHeader: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  auxBack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingRight: 12,
  },
  auxBackText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f766e",
  },
  auxBody: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  placeholderContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
  },
  placeholderDescription: {
    fontSize: 15,
    color: "#475569",
    textAlign: "center",
    lineHeight: 22,
  },
  placeholderBadge: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "#0f766e",
    color: "#0f766e",
    fontWeight: "700",
    fontSize: 12,
  },
});
