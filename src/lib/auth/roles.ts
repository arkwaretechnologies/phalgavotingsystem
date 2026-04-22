export type AppRole = "admin" | "comelec" | "viewer";

export function getAppRoleFromUser(user: { app_metadata?: Record<string, unknown> } | null) {
  const role = user?.app_metadata?.role;
  if (role === "admin" || role === "comelec" || role === "viewer") return role;
  return null;
}

