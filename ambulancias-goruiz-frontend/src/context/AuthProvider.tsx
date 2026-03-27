// src/context/AuthProvider.tsx
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { AuthContext } from "./AuthContext";
import type { User } from "../modules/users";
import { getTokenExpiration } from "../utils/jwtUtils";
import { toastT } from "../utils/toast";
import axios from "../api/axios";

interface Props {
  children: ReactNode;
}

export const AuthProvider = ({ children }: Props) => {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  // ✅ Estado clave
  const [isAuthReady, setIsAuthReady] = useState(false);

  /**
   * Inicialización: leer sessionStorage rápido
   * y refrescar el usuario en segundo plano
   */
  useEffect(() => {
    const initializeAuth = () => {
      const storedToken = sessionStorage.getItem("token");
      const storedUserId = sessionStorage.getItem("userId");
      const storedRole = sessionStorage.getItem("role");
      const storedUser = sessionStorage.getItem("user");

      if (storedToken && storedUserId && storedRole) {
        setToken(storedToken);
        setUserId(storedUserId);
        setRole(storedRole);

        // Pintar user inmediatamente si existe
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch {
            sessionStorage.removeItem("user");
          }
        }

        // Refresco en segundo plano (no bloquea render)
        void refreshUser(storedUserId, storedToken);
      }

      // 👉 A partir de aquí ya podemos decidir rutas
      setIsAuthReady(true);
    };

    initializeAuth();
  }, []);

  /**
   * Refrescar usuario sin bloquear la app
   */
  const refreshUser = async (id: string, tkn: string) => {
    try {
      const res = await axios.get<User>(`/users/${id}`, {
        headers: { Authorization: `Bearer ${tkn}` },
      });

      const freshUser: User = res.data;
      setUser(freshUser);
      sessionStorage.setItem("user", JSON.stringify(freshUser));
    } catch (error: unknown) {
      const status =
        error &&
        typeof error === "object" &&
        "response" in error &&
        (error as { response?: { status?: number } }).response?.status;

      if (status === 401 || status === 403) {
        console.error("❌ Error al refrescar usuario:", error);
        setToken(null);
        setUserId(null);
        setRole(null);
        setUser(null);
        sessionStorage.clear();
        return;
      }

      console.error("❌ Error al refrescar usuario (sesión conservada):", error);
    }
  };

  /**
   * Aviso antes de que expire el token
   */
  useEffect(() => {
    if (!token) return;

    const expiration = getTokenExpiration(token);
    if (!expiration) return;

    const timeLeft = expiration - Date.now();
    const warningThreshold = 60 * 1000; // 1 min

    if (timeLeft > warningThreshold) {
      const timer = setTimeout(() => {
        toastT.warn(["toasts.auth.sessionExpiring"], {
          position: "top-right",
          autoClose: 10000,
        });
      }, timeLeft - warningThreshold);

      return () => clearTimeout(timer);
    }
  }, [token]);

  /**
   * Login
   */
  const login = (
    newToken: string,
    newUserId: string,
    newRole: string,
    newUser: User
  ) => {
    setToken(newToken);
    setUserId(newUserId);
    setRole(newRole);
    setUser(newUser);

    sessionStorage.setItem("token", newToken);
    sessionStorage.setItem("userId", newUserId);
    sessionStorage.setItem("role", newRole);
    sessionStorage.setItem("user", JSON.stringify(newUser));

    setIsAuthReady(true);
  };

  /**
   * Logout
   */
  const logout = () => {
    setToken(null);
    setUserId(null);
    setRole(null);
    setUser(null);

    sessionStorage.clear();
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        userId,
        role,
        user,
        isAuthReady,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
