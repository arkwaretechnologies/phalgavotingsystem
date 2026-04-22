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

export interface GeoGroup {
  id: BigIntId;
  code: string; // e.g. "SL"
  name: string; // e.g. "Southern Luzon"
  is_active: boolean;
  max_votes: number; // default 3
  sort_order: number;
  created_at: string;
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

