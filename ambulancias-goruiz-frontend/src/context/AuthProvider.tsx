// src/context/AuthProvider.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { AuthContext } from "./AuthContext";
import type { User } from "../modules/users";
import type { Company } from "../modules/companies/domain/types";
import { getTokenExpiration } from "../utils/jwtUtils";
import { toastT } from "../utils/toast";
import axios from "../api/axios";
import {
  subscribeAuthAccountChanged,
  subscribeAuthCompanyChanged,
  subscribeAuthModulesChanged,
} from "../utils/authSessionEvents";

interface Props {
  children: ReactNode;
}

/** Initial: wait for /companies/me only when a company user session exists. */
function readInitialCompanyPraemienConfigReady(): boolean {
  if (typeof window === "undefined") return true;
  const storedToken = sessionStorage.getItem("token");
  const storedRole = sessionStorage.getItem("role");
  if (!storedToken) return true;
  if (storedRole === "superadmin") return true;
  return false;
}

export const AuthProvider = ({ children }: Props) => {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [enabledModules, setEnabledModules] = useState<string[] | null>(null);
  const [praemienMode, setPraemienMode] = useState<"automatic" | "manual" | null>(
    null,
  );
  const [praemienModeEffectiveFrom, setPraemienModeEffectiveFrom] = useState<{
    year: number;
    month: number;
  } | null>(null);
  const [companyPraemienConfigReady, setCompanyPraemienConfigReady] = useState(
    readInitialCompanyPraemienConfigReady,
  );

  // ✅ Estado clave
  const [isAuthReady, setIsAuthReady] = useState(false);

  const tokenRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const roleRef = useRef<string | null>(null);

  useEffect(() => {
    tokenRef.current = token;
    userIdRef.current = userId;
    roleRef.current = role;
  }, [token, userId, role]);

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
      const storedModules = sessionStorage.getItem("enabledModules");
      const storedPraemienMode = sessionStorage.getItem("companyPraemienMode");
      const storedPraemienFrom = sessionStorage.getItem(
        "companyPraemienEffectiveFrom",
      );

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

        // Pintar enabledModules inmediatamente si existe en caché
        // Superadmin tiene null (sin companyId, accede a todo)
        if (storedRole !== "superadmin") {
          if (storedModules) {
            try {
              setEnabledModules(JSON.parse(storedModules));
            } catch {
              sessionStorage.removeItem("enabledModules");
            }
          }
          if (storedPraemienMode === "manual" || storedPraemienMode === "automatic") {
            setPraemienMode(storedPraemienMode);
          }
          if (storedPraemienFrom) {
            try {
              const parsed = JSON.parse(storedPraemienFrom) as {
                year?: number;
                month?: number;
              };
              if (
                typeof parsed.year === "number" &&
                typeof parsed.month === "number"
              ) {
                setPraemienModeEffectiveFrom({
                  year: parsed.year,
                  month: parsed.month,
                });
              }
            } catch {
              sessionStorage.removeItem("companyPraemienEffectiveFrom");
            }
          }
          // Refresco de módulos en segundo plano
          void refreshModules(storedToken);
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
  const refreshUser = useCallback(async (id?: string, _tkn?: string) => {
    const targetId = id ?? userIdRef.current;
    if (!targetId) return;

    try {
      const res = await axios.get<User>(`/users/${targetId}`);

      const freshUser: User = res.data;
      setUser(freshUser);
      sessionStorage.setItem("user", JSON.stringify(freshUser));
    } catch (error: unknown) {
      const status =
        error &&
        typeof error === "object" &&
        "response" in error &&
        (error as { response?: { status?: number } }).response?.status;

      if (status === 401 || status === 403 || status === 404) {
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
  }, []);

  /**
   * Refresco de enabledModules desde /api/companies/me.
   * Llamado en background; nunca bloquea el render ni isAuthReady.
   * Superadmin no tiene companyId → 403 esperado → se ignora silenciosamente.
   */
  const refreshModules = useCallback(async (_tkn?: string): Promise<"ok" | "unauthorized"> => {
    if (roleRef.current === "superadmin") {
      setCompanyPraemienConfigReady(true);
      return "ok";
    }

    try {
      const res = await axios.get<Company>("/companies/me");
      const modules: string[] = Array.isArray(res.data.enabledModules)
        ? res.data.enabledModules
        : [];
      setEnabledModules(modules);
      sessionStorage.setItem("enabledModules", JSON.stringify(modules));

      const mode: "automatic" | "manual" =
        res.data.praemienMode === "manual" ? "manual" : "automatic";
      setPraemienMode(mode);
      sessionStorage.setItem("companyPraemienMode", mode);
      const from = res.data.praemienModeEffectiveFrom;
      if (
        from &&
        typeof from.year === "number" &&
        typeof from.month === "number"
      ) {
        const ef = { year: from.year, month: from.month };
        setPraemienModeEffectiveFrom(ef);
        sessionStorage.setItem("companyPraemienEffectiveFrom", JSON.stringify(ef));
      } else {
        setPraemienModeEffectiveFrom(null);
        sessionStorage.removeItem("companyPraemienEffectiveFrom");
      }
      return "ok";
    } catch (error: unknown) {
      const status =
        error &&
        typeof error === "object" &&
        "response" in error &&
        (error as { response?: { status?: number } }).response?.status;

      if (status === 401 || status === 403 || status === 404) {
        return "unauthorized";
      }
      return "ok";
    } finally {
      setCompanyPraemienConfigReady(true);
    }
  }, []);

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
   * Refresco de módulos al recuperar el foco de ventana.
   * Garantiza que los cambios del superadmin en enabledModules se reflejan
   * en sesiones de admin/worker ya activas sin necesidad de reload manual.
   * Superadmin se omite (sin companyId → refreshModules devolvería 403).
   */
  useEffect(() => {
    if (!token || role === "superadmin") return;
    const onFocus = () => void refreshModules(token);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [token, role]);

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

    // Reset modules on new login — load fresh for this session.
    // Superadmin has no companyId → skip.
    setEnabledModules(null);
    sessionStorage.removeItem("enabledModules");
    setPraemienMode(null);
    setPraemienModeEffectiveFrom(null);
    sessionStorage.removeItem("companyPraemienMode");
    sessionStorage.removeItem("companyPraemienEffectiveFrom");
    if (newRole === "superadmin") {
      setCompanyPraemienConfigReady(true);
    } else {
      setCompanyPraemienConfigReady(false);
      void refreshModules(newToken);
    }

    setIsAuthReady(true);
  };

  /**
   * Logout
   */
  const logout = useCallback(() => {
    setToken(null);
    setUserId(null);
    setRole(null);
    setUser(null);
    setEnabledModules(null);
    setPraemienMode(null);
    setPraemienModeEffectiveFrom(null);
    setCompanyPraemienConfigReady(true);

    sessionStorage.clear();
    window.location.href = "/";
  }, []);

  /**
   * Realtime session sync via websocket (modules/company/account changed).
   * Window-focus refresh remains as HTTP fallback.
   */
  useEffect(() => {
    if (!token) return;

    const handleModulesChanged = () => {
      if (roleRef.current === "superadmin") return;
      void refreshModules();
    };

    const handleCompanyChanged = async () => {
      if (roleRef.current === "superadmin") return;
      const result = await refreshModules();
      if (result === "unauthorized") {
        logout();
      }
    };

    const handleAccountChanged = () => {
      void refreshUser();
    };

    const unsubModules = subscribeAuthModulesChanged(handleModulesChanged);
    const unsubCompany = subscribeAuthCompanyChanged(handleCompanyChanged);
    const unsubAccount = subscribeAuthAccountChanged(handleAccountChanged);

    return () => {
      unsubModules();
      unsubCompany();
      unsubAccount();
    };
  }, [token, refreshModules, refreshUser, logout]);

  return (
    <AuthContext.Provider
      value={{
        token,
        userId,
        role,
        user,
        enabledModules,
        praemienMode,
        praemienModeEffectiveFrom,
        companyPraemienConfigReady,
        isAuthReady,
        login,
        logout,
        refreshModules: async () => {
          await refreshModules();
        },
        refreshUser: () => refreshUser(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
