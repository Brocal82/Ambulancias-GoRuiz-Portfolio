import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { AdminBlockedScreen } from "./src/screens/AdminBlockedScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { WorkerTabsShell } from "./src/screens/WorkerTabsShell";

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const {
    isHydrating,
    isAuthenticated,
    user,
    enabledModules,
    scheduleSource,
    authError,
    login,
    logout,
    refreshProfile,
    refreshCompanyModules,
  } =
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
      {isAuthenticated && user?.role !== "worker" ? (
        <AdminBlockedScreen onLogout={logout} />
      ) : isAuthenticated && user ? (
        <WorkerTabsShell
          user={user}
          enabledModules={enabledModules}
          scheduleSource={scheduleSource}
          onLogout={logout}
          onRefreshProfile={refreshProfile}
          onRefreshCompanyModules={refreshCompanyModules}
        />
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
