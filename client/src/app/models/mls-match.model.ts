export interface MLSMatch {
  readonly competition_id: string;
  readonly competition_name: string;
  readonly home_team_name: string;
  readonly away_team_name: string;
  readonly planned_kickoff_time: string;
  readonly stadium_name: string;
  readonly stadium_city: string;
  readonly stadium_country: string;
  readonly match_day: number;
  readonly season: number;
  readonly neutral_venue: boolean;
  [key: string]: unknown;
}

export interface MatchesData {
  readonly lastUpdated: string;
  readonly matches: readonly MLSMatch[];
}
