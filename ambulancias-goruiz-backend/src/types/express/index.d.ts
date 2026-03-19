// backend/src/types/express/index.d.ts
export {};

declare global {
  namespace Express {
    interface Request {
      /** ID del usuario autenticado (seteado por authenticateToken) */
      userId?: string;
      /** Rol del usuario: "admin" | "worker" (seteado por authenticateToken) */
      userRole?: string;
      /** Objeto user para compatibilidad (seteado por authenticateToken) */
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

