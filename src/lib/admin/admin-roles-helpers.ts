import "server-only";

export function logSupabaseError(context: string, err: unknown) {
  const o = err as { message?: string; code?: string; details?: string; hint?: string } | null;
  // eslint-disable-next-line no-console
  console.error(
    context,
    o?.code ?? "no-code",
    o?.message || String(err),
    o?.details || "",
    o?.hint || ""
  );
}
