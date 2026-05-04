import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { login as loginRequest } from "../services/auth";
import { getMyCompanyModules } from "../services/company";
import { ApiError, setApiAuthHandlers } from "../services/http";
import {
  clearStoredSession,
  getStoredSession,
  saveSession,
} from "../services/sessionStorage";
import { getUserById } from "../services/users";
import { AuthUser, CompanyModuleKey, MODULE_KEYS, ScheduleSource } from "../types/auth";

type LoginCredentials = {
  email: string;
  password: string;
};

type AuthContextValue = {
  isHydrating: boolean;
  isAuthenticated: boolean;
  token: string | null;
  user: AuthUser | null;
  enabledModules: CompanyModuleKey[];
  scheduleSource: ScheduleSource;
  authError?: string;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isHydrating, setIsHydrating] = useState(true);
  /** Token actual para `apiRequest` sin esperar al flush de React (evita 401 justo tras login). */
  const tokenRef = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [enabledModules, setEnabledModules] = useState<CompanyModuleKey[]>([]);
  const [scheduleSource, setScheduleSource] = useState<ScheduleSource>("none");
  const [authError, setAuthError] = useState<string | undefined>(undefined);

  const resolveScheduleSource = (modules: CompanyModuleKey[]): ScheduleSource => {
    const hasDynamic = modules.includes(MODULE_KEYS.SCHEDULING);
    const hasExcel = modules.includes(MODULE_KEYS.EXCEL_PLANNING);
    if (hasExcel) return "excel";
    if (hasDynamic) return "dynamic";
    return "none";
  };

  const loadCompanyModules = async (authToken?: string) => {
    try {
      const modules = await getMyCompanyModules(authToken);
      setEnabledModules(modules);
      setScheduleSource(resolveScheduleSource(modules));
    } catch (_error) {
      setEnabledModules([]);
      setScheduleSource("none");
    }
  };

  const logout = useCallback(async () => {
    tokenRef.current = null;
    await clearStoredSession();
    setToken(null);
    setUser(null);
    setEnabledModules([]);
    setScheduleSource("none");
    setAuthError(undefined);
  }, []);

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
      tokenRef.current = response.token;
      setToken(response.token);
      setUser(response.user);
      await loadCompanyModules(response.token);
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
          let userToRestore = parsedUser;
          if (!parsedUser.employeeNumber?.trim() && parsedUser._id?.trim()) {
            try {
              userToRestore = await getUserById(parsedUser._id.trim(), storedToken);
              await saveSession(storedToken, JSON.stringify(userToRestore));
            } catch {
              userToRestore = parsedUser;
            }
          }
          tokenRef.current = storedToken;
          setToken(storedToken);
          setUser(userToRestore);
          await loadCompanyModules(storedToken);
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
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    setApiAuthHandlers({
      getToken: () => tokenRef.current,
      onUnauthorized: async () => {
        await logout();
      },
    });
    return () => setApiAuthHandlers(null);
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isHydrating,
      isAuthenticated: Boolean(token && user),
      token,
      user,
      enabledModules,
      scheduleSource,
      authError,
      login,
      logout,
      refreshProfile,
    }),
    [isHydrating, token, user, enabledModules, scheduleSource, authError],
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
