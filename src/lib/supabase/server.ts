import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // In Server Components, setting cookies can fail; callers should set via Route Handlers if needed.
        }
      },
    },
  });
}

export function createSupabaseServiceRoleClient() {
  const { url, serviceRoleKey } = getSupabaseEnv();
  if (!serviceRoleKey) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

  // Service role should only be used in trusted server code (Route Handlers / Server Actions).
  return createServerClient(url, serviceRoleKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // no-op
      },
    },
  });
}

