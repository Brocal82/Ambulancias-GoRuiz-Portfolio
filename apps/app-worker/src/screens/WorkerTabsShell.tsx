import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";

import { AuthUser, CompanyModuleKey, MODULE_KEYS, ScheduleSource } from "../types/auth";
import { getMyMessages } from "../services/messages";
import { HomeScreen } from "./HomeScreen";
import { WorkerWorkdayScreen } from "./WorkerWorkdayScreen";
import { WorkerAgendaScreen } from "./WorkerAgendaScreen";
import { WorkerDocumentsScreen } from "./WorkerDocumentsScreen";
import { WorkerMessagesScreen } from "./WorkerMessagesScreen";
import { WorkerProfileScreen } from "./WorkerProfileScreen";
import { WorkerWorkdayClosureScreen } from "./WorkerWorkdayClosureScreen";

type WorkerTabKey = "home" | "workday" | "agenda" | "documents" | "messages" | "profile";

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
  /** Pantalla completa de cierre / revision desde el chip “jornada en curso”. */
  const [workdayClosureOpen, setWorkdayClosureOpen] = useState(false);
  const hasWorkdayModule = enabledModules.includes(MODULE_KEYS.WORKDAY);
  const hasAgendaModule =
    enabledModules.includes(MODULE_KEYS.SCHEDULING) ||
    enabledModules.includes(MODULE_KEYS.EXCEL_PLANNING);
  const hasMessagesModule = enabledModules.includes(MODULE_KEYS.MESSAGES);
  const hasDocumentsModule =
    enabledModules.includes(MODULE_KEYS.DOCUMENTS) ||
    enabledModules.includes(MODULE_KEYS.PAYROLL);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  const refreshUnreadMessagesCount = useCallback(async () => {
    if (!hasMessagesModule) {
      setUnreadMessagesCount(0);
      return;
    }

    try {
      const unread = await getMyMessages({ unreadOnly: true });
      setUnreadMessagesCount(unread.length);
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
            onOpenDocuments={() => setActiveTab("documents")}
            onOpenMessages={() => setActiveTab("messages")}
            onOpenProfile={() => setActiveTab("profile")}
            hasWorkdayModule={hasWorkdayModule}
            hasAgendaModule={hasAgendaModule}
            hasDocumentsModule={hasDocumentsModule}
            hasMessagesModule={hasMessagesModule}
            showBottomPreview={false}
          />
        );
      case "workday":
        return hasWorkdayModule ? (
          <WorkerWorkdayScreen
            user={user}
            enabledModules={enabledModules}
            onOpenWorkdayClosure={() => setWorkdayClosureOpen(true)}
          />
        ) : (
          <PlaceholderScreen
            title="Mi Jornada"
            description="Tu empresa no tiene el modulo Jornada activo."
          />
        );
      case "agenda":
        return <WorkerAgendaScreen user={user} scheduleSource={scheduleSource} />;
      case "messages":
        return hasMessagesModule ? (
          <WorkerMessagesScreen userId={user._id} />
        ) : (
          <PlaceholderScreen
            title="Mensajes"
            description="Tu empresa no tiene el modulo Mensajes activo."
          />
        );
      case "documents":
        return hasDocumentsModule ? (
          <WorkerDocumentsScreen />
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
    hasWorkdayModule,
    hasDocumentsModule,
    hasMessagesModule,
    onLogout,
    onRefreshProfile,
    scheduleSource,
    user,
  ]);

  return (
    <View style={styles.root}>
      {workdayClosureOpen ? (
        <WorkerWorkdayClosureScreen user={user} onClose={() => setWorkdayClosureOpen(false)} />
      ) : (
        <>
          <View style={styles.content}>{content}</View>
          <View style={styles.bottomNav}>
        <Pressable onPress={() => setActiveTab("home")} style={styles.tabButton}>
          <Ionicons
            name="home-outline"
            size={22}
            color={activeTab === "home" ? "#0f766e" : "#64748b"}
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
            color={activeTab === "agenda" ? "#0f766e" : "#64748b"}
            style={styles.tabIcon}
          />
          <Text style={[styles.tabText, activeTab === "agenda" && styles.tabTextActive]} numberOfLines={1}>
            Agenda
          </Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab("workday")} style={styles.tabButton}>
          <Ionicons
            name="today-outline"
            size={22}
            color={activeTab === "workday" ? "#0f766e" : "#64748b"}
            style={styles.tabIcon}
          />
          <Text style={[styles.tabText, activeTab === "workday" && styles.tabTextActive]} numberOfLines={1}>
            Mi jornada
          </Text>
        </Pressable>
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
                color={activeTab === "messages" ? "#0f766e" : "#64748b"}
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
            color={activeTab === "profile" ? "#0f766e" : "#64748b"}
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
    borderTopColor: "#e2e8f0",
    backgroundColor: "#ffffff",
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
    color: "#64748b",
    textAlign: "center",
    maxWidth: "100%",
  },
  tabTextActive: {
    color: "#0f766e",
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
