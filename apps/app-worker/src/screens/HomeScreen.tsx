import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthUser } from "../types/auth";

type Props = {
  onLogout: () => void;
  onRefreshProfile: () => Promise<void>;
  user: AuthUser;
  showBottomPreview?: boolean;
};

export function HomeScreen({
  onLogout,
  onRefreshProfile,
  user,
  showBottomPreview = true,
}: Props) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const modules = [
    { key: "jornada", title: "Mi jornada", status: "Activo" },
    { key: "turnos", title: "Mis turnos", status: "Proximamente" },
    { key: "mensajes", title: "Mensajes", status: "Proximamente" },
    { key: "documentos", title: "Documentos", status: "Proximamente" },
    { key: "ausencias", title: "Vacaciones/Ausencias", status: "Proximamente" },
    { key: "perfil", title: "Mi perfil", status: "Proximamente" },
  ];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshProfile();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Worker Dashboard</Text>
          <Text style={styles.subtitle}>
            {user.name} {user.lastName}
          </Text>
          <Text style={styles.meta}>
            Rol: {user.role} {user.ambulanceRole ? `· ${user.ambulanceRole}` : ""}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.iconButton}
            onPress={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <ActivityIndicator color="#0f766e" />
            ) : (
              <Text style={styles.iconButtonText}>Actualizar</Text>
            )}
          </Pressable>
          <Pressable style={styles.iconButton} onPress={onLogout}>
            <Text style={styles.iconButtonText}>Salir</Text>
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
              <Text style={styles.kpiValue}>0</Text>
              <Text style={styles.kpiLabel}>Alertas</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Modulos trabajador (preview)</Text>
          <View style={[styles.modulesGrid, isTablet && styles.modulesGridTablet]}>
            {modules.map((module) => {
              const isActive = module.status === "Activo";
              return (
                <View
                  key={module.key}
                  style={[styles.moduleTile, isTablet && styles.moduleTileTablet]}
                >
                  <Text style={styles.moduleTitle}>{module.title}</Text>
                  <Text style={[styles.moduleStatus, isActive && styles.moduleStatusActive]}>
                    {module.status}
                  </Text>
                </View>
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
    gap: 8,
  },
  iconButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    alignItems: "center",
  },
  iconButtonText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 15,
    color: "#4b5563",
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
    gap: 10,
  },
  modulesGridTablet: {
    gap: 12,
  },
  moduleTile: {
    width: "48%",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    justifyContent: "space-between",
  },
  moduleTileTablet: {
    width: "31%",
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
