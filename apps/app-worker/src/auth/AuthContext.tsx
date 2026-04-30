import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

import { login as loginRequest } from "../services/auth";
import { ApiError, setApiAuthHandlers } from "../services/http";
import {
  clearStoredSession,
  getStoredSession,
  saveSession,
} from "../services/sessionStorage";
import { getUserById } from "../services/users";
import { AuthUser } from "../types/auth";

type LoginCredentials = {
  email: string;
  password: string;
};

type AuthContextValue = {
  isHydrating: boolean;
  isAuthenticated: boolean;
  token: string | null;
  user: AuthUser | null;
  authError?: string;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isHydrating, setIsHydrating] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string | undefined>(undefined);

  const logout = async () => {
    await clearStoredSession();
    setToken(null);
    setUser(null);
    setAuthError(undefined);
  };

  const refreshProfile = async () => {
    if (!user) return;
    const freshUser = await getUserById(user._id);
    setUser(freshUser);
    if (token) {
      await saveSession(token, JSON.stringify(freshUser));
    }
  };

  const login = async (credentials: LoginCredentials) => {
    setAuthError(undefined);
    try {
      const response = await loginRequest(credentials);
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

  useEffect(() => {
    setApiAuthHandlers({
      getToken: () => token,
      onUnauthorized: async () => {
        await logout();
      },
    });
    return () => setApiAuthHandlers(null);
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isHydrating,
      isAuthenticated: Boolean(token && user),
      token,
      user,
      authError,
      login,
      logout,
      refreshProfile,
    }),
    [isHydrating, token, user, authError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
}
