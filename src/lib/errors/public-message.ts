export type PublicMessage = {
  message: string;
};

function normalizeErrorMessage(msg: string) {
  return msg.trim().toLowerCase();
}

export function toPublicMessage(err: unknown, fallback: string): PublicMessage {
  const fallbackMsg = fallback.trim() || "Request failed. Please try again.";
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : typeof err === "object" && err && "message" in err && typeof (err as any).message === "string"
          ? String((err as any).message)
          : "";

  const msg = normalizeErrorMessage(raw);

  // Normalize common Supabase / Postgres messages to user-friendly strings.
  if (msg.includes("jwt") || msg.includes("permission denied") || msg.includes("rls")) {
    return { message: "You don’t have permission to perform that action." };
  }
  if (msg.includes("network") || msg.includes("fetch failed") || msg.includes("timed out")) {
    return { message: "Network error. Please try again." };
  }
  if (msg.includes("duplicate key") || msg.includes("already exists") || msg.includes("unique constraint")) {
    return { message: "That record already exists." };
  }
  if (msg.includes("not found")) {
    return { message: "Record not found." };
  }

  // If the error is already a clean sentence, keep it, but avoid leaking raw SQL details.
  if (raw && raw.length <= 140 && !msg.includes("sql") && !msg.includes("select") && !msg.includes("from public.")) {
    return { message: raw };
  }

  return { message: fallbackMsg };
}

