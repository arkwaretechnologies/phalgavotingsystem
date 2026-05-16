import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export type RateLimitArgs = {
  /** Logical area, e.g. `"admin_login"`, `"voter_login"`. */
  bucket: string;
  /** Per-identifier sub-key, typically `${ip}:${username}` or `${ip}:${queue}`. */
  key: string;
  /** Maximum attempts allowed within the window. */
  limit: number;
  /** Sliding window length in seconds. */
  windowSeconds: number;
};

export type RateLimitResult = {
  ok: boolean;
  /** Remaining attempts in the current window (0 when exhausted). */
  remaining: number;
  /** Seconds the caller should wait before retrying (set when ok=false). */
  retryAfterSeconds?: number;
};

/**
 * In-memory fallback so rate limiting still works when the DB-backed table
 * is unavailable (or hasn't been migrated yet). Effective on a single Node
 * process; multi-instance deployments should run the SQL migration described
 * in this file to use the shared Supabase backend.
 */
const FALLBACK_MEMORY = new Map<string, { resetAt: number; count: number }>();

const FALLBACK_MAX_ENTRIES = 5000;

function cleanupFallback(now: number) {
  if (FALLBACK_MEMORY.size <= FALLBACK_MAX_ENTRIES) return;
  for (const [k, v] of FALLBACK_MEMORY.entries()) {
    if (v.resetAt <= now) FALLBACK_MEMORY.delete(k);
  }
}

function memoryConsume(
  compoundKey: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  cleanupFallback(now);
  const entry = FALLBACK_MEMORY.get(compoundKey);
  if (!entry || entry.resetAt <= now) {
    FALLBACK_MEMORY.set(compoundKey, {
      resetAt: now + windowSeconds * 1000,
      count: 1,
    });
    return { ok: true, remaining: limit - 1 };
  }
  entry.count += 1;
  if (entry.count <= limit) {
    return { ok: true, remaining: Math.max(0, limit - entry.count) };
  }
  return {
    ok: false,
    remaining: 0,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

/**
 * Try to consume one attempt against the bucket+key. Returns `ok=false` when
 * the caller has exceeded the allowed attempts in the current window.
 *
 * Implementation prefers a Supabase-backed counter via the
 * `rate_limit_increment` RPC (so multiple app instances share state). If the
 * RPC is missing or errors, we fall back to a per-process in-memory map. We
 * intentionally do NOT fail open on missing rate-limit infrastructure beyond
 * that fallback — the worst case is single-instance enforcement only.
 *
 * Suggested SQL migration:
 *
 * ```sql
 * create table if not exists rate_limits (
 *   bucket text not null,
 *   key text not null,
 *   window_start timestamptz not null,
 *   count integer not null default 0,
 *   primary key (bucket, key, window_start)
 * );
 *
 * create or replace function rate_limit_increment(
 *   p_bucket text, p_key text, p_window_start timestamptz, p_window_seconds int
 * ) returns int language plpgsql as $$
 * declare new_count int;
 * begin
 *   insert into rate_limits (bucket, key, window_start, count)
 *     values (p_bucket, p_key, p_window_start, 1)
 *     on conflict (bucket, key, window_start)
 *     do update set count = rate_limits.count + 1
 *     returning count into new_count;
 *   delete from rate_limits
 *     where window_start < now() - (p_window_seconds * 5) * interval '1 second';
 *   return new_count;
 * end$$;
 * ```
 */
export async function tryRateLimit(args: RateLimitArgs): Promise<RateLimitResult> {
  const { bucket, key, limit, windowSeconds } = args;
  const compoundKey = `${bucket}:${key}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs).toISOString();

  try {
    const supabase = createSupabaseServiceRoleClient();
    const { data, error } = await supabase.rpc("rate_limit_increment", {
      p_bucket: bucket,
      p_key: key,
      p_window_start: windowStart,
      p_window_seconds: windowSeconds,
    });
    if (!error && typeof data === "number" && Number.isFinite(data)) {
      const count = Number(data);
      if (count <= limit) {
        return { ok: true, remaining: Math.max(0, limit - count) };
      }
      return {
        ok: false,
        remaining: 0,
        retryAfterSeconds: windowSeconds,
      };
    }
  } catch {
    // Fall through to in-memory enforcement below.
  }

  return memoryConsume(compoundKey, limit, windowSeconds);
}
