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
  readonly match_id: string;
  readonly match_status: string;
  readonly home_team_goals: number;
  readonly away_team_goals: number;
  readonly result: string;
  [key: string]: unknown;
}

export interface GoalEvent {
  readonly minute: number;
  readonly player_name: string;
  readonly team_id: string;
  readonly team_name: string;
  readonly is_own_goal: boolean;
  readonly is_penalty: boolean;
  readonly video_url?: string;
  [key: string]: unknown;
}

export interface PreviousResult {
  readonly match: MLSMatch;
  readonly goals: readonly GoalEvent[];
}

export interface MatchesData {
  readonly lastUpdated: string;
  readonly matches: readonly MLSMatch[];
  readonly previousResults: readonly PreviousResult[];
}
