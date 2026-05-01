export type UUID = string;
export type BigIntId = number;

export type TabletStatus = "vacant" | "in_use" | "offline";
export type VotingSessionStatus = "queued" | "voting" | "voted" | "abandoned";

export interface Voter {
  id: UUID;
  full_name: string;
  position: string | null;
  lgu: string | null;
  province: string | null;
  province_league: string | null;
  psgc_code: string | null;
  email: string | null;
  phone: string | null;
  is_verified: boolean | null;
  verified_at: string | null;
  verified_by: BigIntId | null;
  created_at: string;
}

/** Matches `public.geo_groups` (id = bigint identity). */
export interface GeoGroup {
  id: BigIntId;
  code: string;
  name: string;
  /** DB allows null; treat as 3 when null (matches default in DDL). */
  max_votes: number | null;
  is_active: boolean | null;
  sort_order: number | null;
  created_at: string | null;
}

export interface Candidate {
  id: UUID;
  geo_group_id: BigIntId | null;
  full_name: string;
  photo_url: string | null;
  bio: string | null;
  is_active: boolean;
  created_at: string;
  confcode: string;
  gender?: string | null;
  civil_status?: string | null;
  date_of_birth?: string | null;
  post_office_address?: string | null;
  present_position?: string | null;
  highest_educational_attainment?: string | null;
  provincial_league?: string | null;
}

/** `public.conference` — rows keyed by `confcode`. */
export interface Conference {
  confcode: string;
  name: string | null;
  date_from: string | null;
  date_to: string | null;
  venue: string | null;
}

/** `public.app_settings` single row (id = 1). */
export interface AppSettings {
  id: number;
  active_confcode: string | null;
  vote_start_date_time?: string | null;
  vote_end_date_time?: string | null;
  updated_at: string;
}

export interface VotingSession {
  id: UUID;
  voter_id: UUID | null;
  queue_number: number;
  token: string; // char(6)
  qr_payload: string | null;
  status: VotingSessionStatus | null;
  tablet_id: BigIntId | null;
  voted_via: "tablet" | "phone" | null;
  session_start: string | null;
  session_end: string | null;
  created_at: string;
}

export interface Ballot {
  id: UUID;
  session_id: UUID | null;
  voter_id: UUID | null;
  confcode: string | null;
  is_submitted: boolean | null;
  submitted_at: string | null;
  created_at: string;
}

export interface BallotChoice {
  id: UUID;
  ballot_id: UUID;
  geo_group_id: BigIntId;
  candidate_id: UUID;
  created_at: string;
}

