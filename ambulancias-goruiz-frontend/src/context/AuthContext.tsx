// src/context/AuthContext.ts
import { createContext } from "react";
import type { User } from "../modules/users";

export interface AuthContextType {
  token: string | null;
  userId: string | null;
  role: string | null;
  user: User | null;

  /**
   * Canonical module keys enabled for the user's company.
   * null  → not yet loaded (treat as all-enabled to avoid false negatives).
   * []    → explicitly no modules (should not occur for active companies
   *          once the backfill script has been run).
   * string[] → the definitive list from the Company document.
   *
   * Superadmin users: always null (bypasses module checks entirely).
   */
  enabledModules: string[] | null;

  /**
   * Company prämien mode from GET /companies/me (null until loaded or superadmin).
   * Phase 2: drives workday UI only; backend unchanged.
   */
  praemienMode: "automatic" | "manual" | null;
  praemienModeEffectiveFrom: { year: number; month: number } | null;

  /**
   * For company users (admin/worker), false until the first /companies/me
   * attempt finishes (then true even on error, so UI does not block forever).
   * True when not logged in or superadmin (no company config to load).
   */
  companyPraemienConfigReady: boolean;

  // ✅ CLAVE para evitar parpadeos
  isAuthReady: boolean;

  login: (
    token: string,
    userId: string,
    role: string,
    user: User
  ) => void;

  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);
