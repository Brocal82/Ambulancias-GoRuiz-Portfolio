import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LoginScreen } from "./src/screens/LoginScreen";

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { isHydrating, isAuthenticated, user, authError, login, logout, refreshProfile } =
    useAuth();

  if (isHydrating) {
    return (
      <View style={styles.splash}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      {isAuthenticated && user ? (
        <HomeScreen onLogout={logout} onRefreshProfile={refreshProfile} user={user} />
      ) : (
        <LoginScreen onLogin={login} errorMessage={authError} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
});
