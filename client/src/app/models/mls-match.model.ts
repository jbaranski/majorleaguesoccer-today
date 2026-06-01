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
  readonly home_team_goals?: number | null;
  readonly away_team_goals?: number | null;
  readonly home_team_penalty_goals?: number | null;
  readonly away_team_penalty_goals?: number | null;
  [key: string]: unknown;
}

export interface GoalEvent {
  readonly minute?: string;
  readonly playerName: string;
  readonly side: 'home' | 'away';
  readonly isOwnGoal: boolean;
  readonly videoUrl?: string;
}

export interface MatchResult {
  readonly match: MLSMatch;
  readonly goalEvents: readonly GoalEvent[];
}

export interface MatchesData {
  readonly lastUpdated: string;
  readonly todayMatches: readonly MLSMatch[];
  readonly yesterdayResults: readonly MatchResult[];
}
