export function homePathForRole(role: string | null): string {
  if (role === "superadmin") return "/superadmin";
  if (role === "admin") return "/admin";
  if (role === "jefe_mecanicos") return "/mechanics/dashboard";
  if (role === "mecanico") return "/mechanics";
  return "/worker";
}

