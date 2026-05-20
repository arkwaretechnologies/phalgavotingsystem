export type AdminResultsTallyRow = {
  candidate_id: string;
  geo_group_id: number | null;
  full_name: string;
  photo_url: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  vote_count: number;
};

export type AdminResultsGeoGroup = {
  id: number;
  code: string;
  name: string;
  sort_order: number | null;
};

/** COMELEC roster row for canvass report signatories (active conference). */
export type AdminResultsComelecMember = {
  id: string;
  name: string | null;
  position: string | null;
  comelec_position: string | null;
  sort_order: number | null;
};

export type AdminResultsPayload = {
  activeConfcode: string | null;
  conferenceName: string | null;
  /** All rows in `public.voters` (denominator for live tally bars: votes ÷ total voter roll). */
  totalVoters: number;
  geoGroups: AdminResultsGeoGroup[];
  rows: AdminResultsTallyRow[];
  fetchedAt: string;
  /** Used for canvass PDF/preview signature blocks; empty when none or load failed. */
  comelecMembers: AdminResultsComelecMember[];
};
