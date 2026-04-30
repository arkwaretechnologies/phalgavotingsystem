/** Philippine Standard Time (no DST). Used for admin voting schedule inputs. */
export const MANILA_TZ = "Asia/Manila";

const DT_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/**
 * Format a UTC instant for `<input type="datetime-local">`, showing wall time in Manila.
 */
export function utcIsoToManilaDatetimeLocal(iso: string | null | undefined): string {
  if (iso == null) return "";
  const s = String(iso).trim();
  if (!s) return "";
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return "";

  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Parse `YYYY-MM-DDTHH:mm` as Manila wall time and return a UTC ISO string for `timestamptz`.
 */
export function manilaDatetimeLocalToUtcIso(local: string | null | undefined): string | null {
  if (local == null) return null;
  const s = String(local).trim();
  if (!s) return null;
  if (!DT_LOCAL_RE.test(s)) return null;
  const iso = `${s}:00+08:00`;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

/** Split Manila wall time from DB instant into HTML `date` / `time` input values (always PHT). */
export function utcIsoToManilaDateAndTime(
  iso: string | null | undefined,
): { date: string; time: string } {
  const local = utcIsoToManilaDatetimeLocal(iso);
  if (!local) return { date: "", time: "" };
  const [date, time] = local.split("T");
  return { date: date ?? "", time: time ?? "" };
}

/**
 * Combine `type="date"` and `type="time"` as Manila wall time → UTC ISO.
 * - Both empty → `null`
 * - Only one set → `"partial"`
 * - Invalid combination → `"invalid"`
 */
export function manilaDateAndTimeToUtcIso(
  date: string | null | undefined,
  time: string | null | undefined,
): string | null | "partial" | "invalid" {
  const d = String(date ?? "").trim();
  const tRaw = String(time ?? "").trim();
  if (!d && !tRaw) return null;
  if (!d || !tRaw) return "partial";
  const t = tRaw.length >= 5 ? tRaw.slice(0, 5) : tRaw;
  const local = `${d}T${t}`;
  if (!DT_LOCAL_RE.test(local)) return "invalid";
  const iso = manilaDatetimeLocalToUtcIso(local);
  return iso == null ? "invalid" : iso;
}
