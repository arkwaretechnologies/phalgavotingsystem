import "server-only";

import { redirect } from "next/navigation";

export type AdminToastKind = "success" | "error" | "info";

/** Append toast query params without breaking an existing `?q=…&page=…` on returnTo. */
export function adminPathWithToast(returnTo: string, kind: AdminToastKind, message: string): string {
  const [path, query = ""] = returnTo.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("toast", kind);
  params.set("message", message);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function adminRedirectWithToast(returnTo: string, kind: AdminToastKind, message: string): never {
  redirect(adminPathWithToast(returnTo, kind, message));
}
