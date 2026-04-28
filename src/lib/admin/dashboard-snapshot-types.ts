export type DashboardGeoTopThree = {
  geoGroupId: number;
  geoCode: string;
  geoName: string;
  topThree: { candidateName: string; voteCount: number }[];
};

export type DashboardSnapshot = {
  fetchedAt: string;
  activeConfcode: string | null;
  conferenceName: string | null;
  votingWindow: {
    start: string | null;
    end: string | null;
    status: "open" | "not_started" | "closed";
    /** ms until end (open) or start (not_started). null if unbounded/unknown. */
    msRemaining: number | null;
  };
  totalVoters: number;
  votedVoters: number;
  geoTopThree: DashboardGeoTopThree[];
  sessionStatusCounts: { status: string; label: string; count: number }[];
  tabletStatusCounts: { status: string; label: string; count: number }[];
  queuedNumbersVerified: number[];
  votingQueueNumbers: number[];
  /** `status = voting` and `voted_via = tablet` (physical station). */
  activeVotingAtStations: number;
  /** `status = voting` and `voted_via = phone` (QR on own device). */
  activeVotingOnOwnDevices: number;
  /** `status = voting` with missing `voted_via` (legacy / edge). */
  activeVotingChannelUnknown: number;
};
