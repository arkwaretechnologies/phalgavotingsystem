export function getSupabaseEnv() {
  // Support both naming styles:
  // - Preferred for client-safe usage: NEXT_PUBLIC_SUPABASE_*
  // - Existing local setup: SUPABASE_*
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "Missing env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL for server-only usage)"
    );
  }
  if (!anonKey) {
    throw new Error(
      "Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY for server-only usage)"
    );
  }

  return { url, anonKey, serviceRoleKey };
}

