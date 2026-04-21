// src/hooks/useModules.ts
import { useAuth } from "./useAuth";

/**
 * Hook for module-based feature gating.
 *
 * hasModule(key):
 *   - Returns true  if the current user's company has the module enabled.
 *   - Returns true  for superadmin (global access, no companyId).
 *   - Returns true  while enabledModules is still loading (null) to avoid
 *     false negatives that would cause dashboard flicker.
 *   - Returns false only when enabledModules is a loaded array that does
 *     not include the requested key.
 *
 * This hook is purely for rendering/route UX.
 * Backend requireModule() middleware is the authoritative security gate.
 */
export function useModules() {
  const { enabledModules, role } = useAuth();

  function hasModule(key: string): boolean {
    if (role === "superadmin") return true;
    if (enabledModules === null) return true; // still loading — optimistic
    return enabledModules.includes(key);
  }

  return { hasModule, enabledModules };
}
