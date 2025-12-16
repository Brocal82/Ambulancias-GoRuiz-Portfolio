// src/context/AuthContext.ts
import { createContext } from "react";
import type { User } from "../types/user"; // ✅ Importamos el tipo User

export interface AuthContextType {
  token: string | null;
  userId: string | null;
  role: string | null;
  user: User | null; // ✅ Añadido aquí
  login: (token: string, userId: string, role: string, user: User) => void; // ✅ Añadimos user al login
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);
