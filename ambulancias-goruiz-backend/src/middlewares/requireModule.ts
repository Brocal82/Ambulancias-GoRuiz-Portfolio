import type { Request, Response, NextFunction } from "express";
import Company from "../modules/companies/models/company.model";

/**
 * Route middleware that enforces per-company module access.
 *
 * Usage: place AFTER authenticateToken, BEFORE authorizeRole.
 *
 *   router.get("/", authenticateToken, requireModule("hospitals"), authorizeRole("admin"), handler);
 *
 * Rules:
 *   - Superadmin bypasses all module checks (no companyId, global access).
 *   - Uses a direct DB lookup on every request. No cache.
 *     At this app's scale this is sub-millisecond via the default _id index.
 *   - If the company document has an empty enabledModules array this guard
 *     BLOCKS access. For existing tenants, run scripts/backfill-company-modules.ts
 *     (or npm run backfill:company-modules) so every company has an explicit list.
 */
export function requireModule(moduleKey: string) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (req.userRole === "superadmin") {
      next();
      return;
    }

    const companyId = req.companyId;
    if (!companyId) {
      res.status(403).json({ message: "No tienes empresa asignada." });
      return;
    }

    try {
      const company = await Company.findById(companyId)
        .select("enabledModules")
        .lean();

      if (!company) {
        res.status(403).json({ message: "Empresa no encontrada." });
        return;
      }

      const enabled: string[] = Array.isArray(company.enabledModules)
        ? company.enabledModules
        : [];

      if (!enabled.includes(moduleKey)) {
        res.status(403).json({
          message: `El módulo '${moduleKey}' no está habilitado para esta empresa.`,
        });
        return;
      }

      next();
    } catch (err) {
      console.error("[requireModule] Error al verificar módulo:", err);
      res.status(500).json({ message: "Error interno del servidor." });
    }
  };
}
