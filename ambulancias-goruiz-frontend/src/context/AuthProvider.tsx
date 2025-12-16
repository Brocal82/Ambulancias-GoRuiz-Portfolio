// src/context/AuthProvider.tsx
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { AuthContext } from "./AuthContext";
import type { User } from "../types/user";
import { getTokenExpiration } from "../utils/jwtUtils";
import { toastT } from "../utils/toast";

interface Props {
  children: ReactNode;
}

export const AuthProvider = ({ children }: Props) => {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = sessionStorage.getItem("token");
      const storedUserId = sessionStorage.getItem("userId");
      const storedRole = sessionStorage.getItem("role");

      if (storedToken && storedUserId && storedRole) {
        setToken(storedToken);
        setUserId(storedUserId);
        setRole(storedRole);

        try {
          const res = await fetch(`/api/users/${storedUserId}`, {
            headers: { Authorization: `Bearer ${storedToken}` },
          });

          if (!res.ok) throw new Error("No se pudo obtener el usuario");

          const freshUser: User = await res.json();
          setUser(freshUser);
          sessionStorage.setItem("user", JSON.stringify(freshUser));
        } catch (error) {
          console.error("❌ Error al refrescar usuario:", error);

          // 🔒 Cierre de sesión manual para evitar dependencia de logout
          setToken(null);
          setUserId(null);
          setRole(null);
          setUser(null);
          sessionStorage.clear();
          window.location.href = "/";
        }
      }

      setLoading(false);
    };

    initializeAuth();
  }, []);

  // ⏰ Advertencia antes de que expire el token
  useEffect(() => {
    if (!token) return;

    const expiration = getTokenExpiration(token);
    if (!expiration) return;

    const timeLeft = expiration - Date.now();
    const warningThreshold = 60 * 1000; // 1 minuto

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

  const login = (
    newToken: string,
    newUserId: string,
    newRole: string,
    newUser: User,
  ) => {
    setToken(newToken);
    setUserId(newUserId);
    setRole(newRole);
    setUser(newUser);

    sessionStorage.setItem("token", newToken);
    sessionStorage.setItem("userId", newUserId);
    sessionStorage.setItem("role", newRole);
    sessionStorage.setItem("user", JSON.stringify(newUser));
  };

  /** Cierre de sesión */
  const logout = () => {
    // 🔸 NO tocamos las marcas de “workdayClosed-…”
    //     → así permanecen asociadas al usuario y a la fecha.

    /* Limpiar estado y storage */
    setToken(null);
    setUserId(null);
    setRole(null);
    setUser(null);

    sessionStorage.clear();
    window.location.href = "/"; // redirección a la pantalla de login / inicio
  };

  if (loading) return <p className="p-4">Cargando sesión...</p>;

  return (
    <AuthContext.Provider value={{ token, userId, role, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
