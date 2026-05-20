/** Macro geo areas stored on `public.voters.geo_area`. */
export const VOTER_GEO_AREAS = [
  "NORTHERN LUZON",
  "SOUTHERN LUZON",
  "VISAYAS",
  "MINDANAO",
] as const;

export type VoterGeoArea = (typeof VOTER_GEO_AREAS)[number];

export function isVoterGeoArea(value: string): value is VoterGeoArea {
  return (VOTER_GEO_AREAS as readonly string[]).includes(value);
}

/** Returns a valid geo area or `null` if empty / invalid. */
export function parseVoterGeoArea(raw: FormDataEntryValue | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  return isVoterGeoArea(s) ? s : null;
}

/** Label for reports: macro area, Unassigned, or Other (unknown `geo_area` value). */
export function voterGeoReportBucket(ga: string | null | undefined): string {
  const s = String(ga ?? "").trim();
  if (!s) return "Unassigned";
  return isVoterGeoArea(s) ? s : "Other";
}
