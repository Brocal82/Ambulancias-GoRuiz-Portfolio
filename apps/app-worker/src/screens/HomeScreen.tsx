import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthUser } from "../types/auth";

type Props = {
  onLogout: () => void;
  onRefreshProfile: () => Promise<void>;
  user: AuthUser;
};

export function HomeScreen({ onLogout, onRefreshProfile, user }: Props) {
  const [isRefreshing, setIsRefreshing] = useState(false);

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
      <View style={styles.container}>
        <Text style={styles.title}>Inicio trabajador</Text>
        <Text style={styles.subtitle}>
          Bienvenido, {user.name} {user.lastName}
        </Text>
        <Text style={styles.meta}>
          Rol: {user.role} {user.ambulanceRole ? `· ${user.ambulanceRole}` : ""}
        </Text>

        <Pressable style={styles.secondaryButton} onPress={handleRefresh} disabled={isRefreshing}>
          {isRefreshing ? (
            <ActivityIndicator color="#0f766e" />
          ) : (
            <Text style={styles.secondaryButtonText}>Refrescar perfil</Text>
          )}
        </Pressable>

        <Pressable style={styles.button} onPress={onLogout}>
          <Text style={styles.buttonText}>Cerrar sesion</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 16,
    color: "#4b5563",
  },
  meta: {
    fontSize: 14,
    color: "#64748b",
  },
  button: {
    marginTop: 4,
    backgroundColor: "#334155",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#0f766e",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#0f766e",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
