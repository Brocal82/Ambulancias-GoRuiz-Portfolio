// backend/src/types/express/index.d.ts
export {};

declare global {
  namespace Express {
    interface Request {
      /** ID del usuario autenticado (seteado por authenticateToken) */
      userId?: string;
      /** Rol del usuario: "admin" | "worker" (seteado por authenticateToken) */
      userRole?: string;
      /** ID de empresa cuando el usuario pertenece a una (seteado por authenticateToken) */
      companyId?: string;
      /** Objeto user para compatibilidad (seteado por authenticateToken) */
      user?: {
        id: string;
        email: string;
        role: string;
        companyId?: string;
      };
    }
  }
}

