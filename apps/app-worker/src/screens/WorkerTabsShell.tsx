import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AuthUser, ScheduleSource } from "../types/auth";
import { HomeScreen } from "./HomeScreen";
import { WorkerAgendaScreen } from "./WorkerAgendaScreen";

type WorkerTabKey = "home" | "agenda" | "messages" | "profile";

type Props = {
  user: AuthUser;
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
  scheduleSource,
  onLogout,
  onRefreshProfile,
}: Props) {
  const [activeTab, setActiveTab] = useState<WorkerTabKey>("home");

  const content = useMemo(() => {
    switch (activeTab) {
      case "home":
        return (
          <HomeScreen
            user={user}
            onLogout={onLogout}
            onRefreshProfile={onRefreshProfile}
            showBottomPreview={false}
          />
        );
      case "agenda":
        return <WorkerAgendaScreen user={user} scheduleSource={scheduleSource} />;
      case "messages":
        return (
          <PlaceholderScreen
            title="Mensajes"
            description="Canal interno para avisos operativos y comunicaciones."
          />
        );
      case "profile":
        return (
          <PlaceholderScreen
            title="Perfil"
            description="Datos personales, documentos y configuracion de cuenta."
          />
        );
      default:
        return null;
    }
  }, [activeTab, onLogout, onRefreshProfile, scheduleSource, user]);

  return (
    <View style={styles.root}>
      <View style={styles.content}>{content}</View>
      <View style={styles.bottomNav}>
        <Pressable onPress={() => setActiveTab("home")} style={styles.tabButton}>
          <Text style={[styles.tabText, activeTab === "home" && styles.tabTextActive]}>
            Inicio
          </Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab("agenda")} style={styles.tabButton}>
          <Text style={[styles.tabText, activeTab === "agenda" && styles.tabTextActive]}>
            Agenda
          </Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab("messages")} style={styles.tabButton}>
          <Text style={[styles.tabText, activeTab === "messages" && styles.tabTextActive]}>
            Mensajes
          </Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab("profile")} style={styles.tabButton}>
          <Text style={[styles.tabText, activeTab === "profile" && styles.tabTextActive]}>
            Perfil
          </Text>
        </Pressable>
      </View>
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
    paddingVertical: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
  },
  tabText: {
    fontSize: 12,
    color: "#64748b",
  },
  tabTextActive: {
    color: "#0f766e",
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
