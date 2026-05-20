import "server-only";

type PageResult<T> = { data: T[] | null; error: { message?: string } | null };

/**
 * Fetch ALL rows from a Supabase/PostgREST query by paginating with `.range()`.
 *
 * Important: the query MUST have a deterministic ordering (via `.order(...)`)
 * if the underlying table can change during reads.
 *
 * Pagination advances by the number of rows **actually returned**. PostgREST often
 * caps responses (e.g. 1000 rows) even when `to - from + 1` is larger; advancing
 * by `pageSize` only would skip rows after the first truncated page.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => Promise<PageResult<T>>,
  opts?: { pageSize?: number },
): Promise<T[]> {
  const pageSize = Math.max(1, Math.min(5000, opts?.pageSize ?? 1000));
  const MAX_PAGES = 100_000;
  const out: T[] = [];

  for (let from = 0, p = 0; ; p += 1) {
    if (p >= MAX_PAGES) {
      throw new Error(`fetchAllRows: exceeded ${MAX_PAGES} pages (safety limit).`);
    }
    const to = from + pageSize - 1;
    const { data, error } = await page(from, to);
    if (error) throw new Error(error.message ?? "Supabase query failed");

    const rows = data ?? [];
    if (rows.length === 0) break;

    out.push(...rows);
    from += rows.length;
  }

  return out;
}

