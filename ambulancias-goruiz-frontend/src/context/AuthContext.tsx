// src/context/AuthContext.ts
import { createContext } from "react";
import type { User } from "../modules/users";

export interface AuthContextType {
  token: string | null;
  userId: string | null;
  role: string | null;
  user: User | null;

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
