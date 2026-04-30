import "server-only";

type PageResult<T> = { data: T[] | null; error: { message?: string } | null };

/**
 * Fetch ALL rows from a Supabase/PostgREST query by paginating with `.range()`.
 *
 * Important: the query MUST have a deterministic ordering (via `.order(...)`)
 * if the underlying table can change during reads.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => Promise<PageResult<T>>,
  opts?: { pageSize?: number },
): Promise<T[]> {
  const pageSize = Math.max(1, Math.min(5000, opts?.pageSize ?? 1000));
  const out: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await page(from, to);
    if (error) throw new Error(error.message ?? "Supabase query failed");

    const rows = data ?? [];
    out.push(...rows);

    if (rows.length < pageSize) break;
  }

  return out;
}

