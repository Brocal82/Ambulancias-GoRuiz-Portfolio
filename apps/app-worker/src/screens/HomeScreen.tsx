import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { AuthUser } from "../types/auth";

type Props = {
  onLogout: () => void;
  user: AuthUser;
};

export function HomeScreen({ onLogout, user }: Props) {
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
    marginTop: 8,
    backgroundColor: "#334155",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
