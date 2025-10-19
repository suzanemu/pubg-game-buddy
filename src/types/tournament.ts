export interface Team {
  id: string;
  name: string;
  totalPoints: number;
  placementPoints: number;
  killPoints: number;
  totalKills: number;
  matchesPlayed: number;
  firstPlaceWins: number;
  tournament_id?: string;
}

export interface Tournament {
  id: string;
  name: string;
  description?: string;
  total_matches: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MatchResult {
  teamId: string;
  placement: number;
  kills: number;
  points: number;
}

export interface Match {
  id: string;
  matchNumber: number;
  results: MatchResult[];
}

export const PLACEMENT_POINTS: Record<number, number> = {
  1: 10,
  2: 6,
  3: 5,
  4: 4,
  5: 3,
  6: 2,
  7: 1,
  8: 1,
  9: 0,
  10: 0,
  11: 0,
  12: 0,
  13: 0,
  14: 0,
  15: 0,
  16: 0,
  17: 0,
  18: 0,
};

export const KILL_POINTS = 1;

export function calculatePoints(placement: number, kills: number): number {
  const placementPoints = PLACEMENT_POINTS[placement] || 0;
  const killPoints = kills * KILL_POINTS;
  return placementPoints + killPoints;
}
