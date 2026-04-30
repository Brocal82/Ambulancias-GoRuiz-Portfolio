import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { HomeScreen } from "./src/screens/HomeScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { login } from "./src/services/auth";
import { ApiError } from "./src/services/http";
import {
  clearStoredSession,
  getStoredSession,
  saveSession,
} from "./src/services/sessionStorage";
import { AuthUser } from "./src/types/auth";

export default function App() {
  const [isHydrating, setIsHydrating] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string | undefined>(undefined);

  useEffect(() => {
    const hydrateSession = async () => {
      try {
        const { token: storedToken, userJson } = await getStoredSession();
        if (storedToken && userJson) {
          const parsedUser = JSON.parse(userJson) as AuthUser;
          setToken(storedToken);
          setUser(parsedUser);
        }
      } catch (_error) {
        await clearStoredSession();
      } finally {
        setIsHydrating(false);
      }
    };

    void hydrateSession();
  }, []);

  const handleLogin = async (credentials: { email: string; password: string }) => {
    setAuthError(undefined);
    try {
      const response = await login(credentials);
      await saveSession(response.token, JSON.stringify(response.user));
      setToken(response.token);
      setUser(response.user);
    } catch (error) {
      if (error instanceof ApiError) {
        setAuthError(error.message);
        return;
      }
      setAuthError("No se pudo iniciar sesion.");
    }
  };

  const handleLogout = async () => {
    await clearStoredSession();
    setToken(null);
    setUser(null);
    setAuthError(undefined);
  };

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
      {token && user ? (
        <HomeScreen onLogout={handleLogout} user={user} />
      ) : (
        <LoginScreen onLogin={handleLogin} errorMessage={authError} />
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
