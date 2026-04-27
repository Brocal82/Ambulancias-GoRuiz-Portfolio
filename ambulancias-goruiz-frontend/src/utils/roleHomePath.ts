export function homePathForRole(role: string | null): string {
  if (role === "superadmin") return "/superadmin";
  if (role === "admin") return "/admin";
  if (role === "mecanico" || role === "jefe_mecanicos") return "/mechanics";
  return "/worker";
}

