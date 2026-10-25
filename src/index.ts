import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findGoalVideo, parseGoalVideos } from './goal-videos.js';
import type { BrightcoveItem, GoalVideo, Side, VideoTeam } from './goal-videos.js';

interface MLSMatch {
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
  readonly match_id?: string;
  readonly match_status?: string;
  readonly home_team_goals?: number;
  readonly away_team_goals?: number;
  readonly home_team_three_letter_code?: string;
  readonly away_team_three_letter_code?: string;
  readonly home_team_short_name?: string;
  readonly away_team_short_name?: string;
  [key: string]: unknown;
}

interface MLSMatchResponse {
  readonly schedule: readonly MLSMatch[];
}

interface GoalEvent {
  readonly minute?: string;
  readonly playerName: string;
  readonly teamName: string;
  readonly side: Side;
  readonly isOwnGoal: boolean;
  readonly isShootout: boolean;
}

interface MatchResult {
  readonly match: MLSMatch;
  readonly goalEvents: readonly GoalEvent[];
  readonly goalVideos: readonly GoalVideo[];
}

interface KeyEventScorer {
  readonly player_first_name?: string;
  readonly player_last_name?: string;
  readonly player_alias?: string;
  readonly team_name: string;
}

interface KeyEvent {
  readonly type: string;
  readonly sub_type: string;
  readonly event: KeyEventScorer & {
    readonly minute_of_play: string;
    readonly shot_at_goal?: KeyEventScorer;
  };
}

interface KeyEventsResponse {
  readonly events: readonly KeyEvent[];
}

interface BrightcoveResponse {
  readonly items: readonly BrightcoveItem[];
}

interface GoalEventOutput {
  readonly minute?: string;
  readonly playerName: string;
  readonly teamName: string;
  readonly side: Side;
  readonly isOwnGoal: boolean;
  readonly isShootout: boolean;
  readonly videoUrl?: string;
}

interface MatchResultOutput {
  readonly match: MLSMatch;
  readonly goalEvents: readonly GoalEventOutput[];
}

interface MatchesOutput {
  readonly lastUpdated: string;
  readonly todayMatches: readonly MLSMatch[];
  readonly yesterdayResults: readonly MatchResultOutput[];
}

// TODO: Input via Actions
const SEASON = 'MLS-SEA-0001KA';

// TODO: Input via Actions
const EXCLUDED_COMPETITION_IDS = new Set(['MLS-COM-000003', 'MLS-COM-000004', 'MLS-COM-00002R', 'MLS-COM-00002X']);

const COMPETITION_PRIORITIES = new Map([
  ['MLS-COM-000001', 1], // Major League Soccer - Regular Season
  ['MLS-COM-000002', 2], // Major League Soccer - Cup Playoffs
  ['MLS-COM-000005', 3], // MLS All-Star Game
  ['MLS-COM-00002Y', 4], // FIFA Club World Cup
  ['MLS-COM-000006', 5], // Leagues Cup
  ['MLS-COM-00002U', 6], // U.S. Open Cup
  ['MLS-COM-000007', 7], // Campeones Cup
  ['MLS-COM-00002V', 8], // Canadian Championship
  ['MLS-COM-00002W', 9], // Copa America
  ['MLS-COM-00002Z', 10], // CONCACAF Nations League
  ['MLS-COM-00000K', 11], // CONCACAF Champions Cup
  ['MLS-COM-00002S', 12] // Club Friendly Matches
]);

const getCompetitionPriority = (competitionId: string): number => {
  return COMPETITION_PRIORITIES.get(competitionId) ?? Number.MAX_SAFE_INTEGER;
};

// Returns the current date, or a Date anchored to DATE_OVERRIDE if set (format: YYYY-MM-DD).
// Uses noon UTC so the resulting ET date is always correct regardless of DST.
const getNow = (): Date => {
  const override = process.env['DATE_OVERRIDE']?.trim();
  if (override) {
    return new Date(`${override}T17:00:00.000Z`); // noon ET in UTC, DST-safe
  }
  return new Date();
};

// Converts any Date to a YYYY-MM-DD string in ET, regardless of system TZ.
const toETDateStr = (date: Date): string => {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
};

const getUrl = (now: Date): string => {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const baseUrl = `https://stats-api.mlssoccer.com/matches/seasons/${SEASON}`;
  const params = new URLSearchParams({
    'match_date[gte]': yesterday.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
    'match_date[lte]': tomorrow.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
    per_page: '1000',
    sort: 'planned_kickoff_time:asc,home_team_name:asc'
  });

  return `${baseUrl}?${params.toString()}`;
};

const getData = async (url: string): Promise<MLSMatchResponse> => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'JEFF-Bot'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return (await response.json()) as MLSMatchResponse;
};

const fetchMatchEvents = async (
  matchId: string,
  homeTeamName: string,
  awayTeamName: string
): Promise<readonly GoalEvent[]> => {
  try {
    const url = `https://stats-api.mlssoccer.com/matches/${matchId}/key_events?per_page=1000`;
    const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'JEFF-Bot' } });
    if (!response.ok) return [];
    const data = (await response.json()) as KeyEventsResponse;
    return data.events
      .filter((e) => e.sub_type === 'goals' || e.type === 'own_goals')
      .map((e) => {
        const isOwnGoal = e.type === 'own_goals';
        const isShootout = !e.event.minute_of_play;
        // Penalty events nest the actual scorer inside shot_at_goal; regular goals are at event level
        const scorer: KeyEventScorer = e.event.shot_at_goal ?? e.event;
        const fullName = `${scorer.player_first_name ?? ''} ${scorer.player_last_name ?? ''}`.trim();
        const scoringTeamName = scorer.team_name;
        // For own goals the player's team conceded, so the scoring side is the opponent
        const scoringTeam = isOwnGoal
          ? scoringTeamName === homeTeamName
            ? awayTeamName
            : homeTeamName
          : scoringTeamName;
        return {
          ...(e.event.minute_of_play ? { minute: e.event.minute_of_play } : {}),
          playerName: fullName || scorer.player_alias || 'Unknown',
          teamName: scoringTeamName,
          side: scoringTeam === homeTeamName ? 'home' : 'away',
          isOwnGoal,
          isShootout
        } satisfies GoalEvent;
      });
  } catch {
    return [];
  }
};

const fetchGoalVideos = async (matchId: string, home: VideoTeam, away: VideoTeam): Promise<readonly GoalVideo[]> => {
  try {
    const url = `https://dapi.mlssoccer.com/v2/content/en-us/brightcovevideos?fields.sportecMatchId=${matchId}`;
    const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'JEFF-Bot' } });
    if (!response.ok) return [];
    const data = (await response.json()) as BrightcoveResponse;
    return parseGoalVideos(data.items, home, away);
  } catch {
    return [];
  }
};

const sortMatches = (matches: readonly MLSMatch[]): readonly MLSMatch[] => {
  return [...matches].sort((a, b) => {
    const priorityA = getCompetitionPriority(a.competition_id);
    const priorityB = getCompetitionPriority(b.competition_id);

    const priorityComparison = priorityA - priorityB;
    if (priorityComparison !== 0) {
      return priorityComparison;
    }

    const timeComparison = a.planned_kickoff_time.localeCompare(b.planned_kickoff_time);
    if (timeComparison !== 0) {
      return timeComparison;
    }

    return a.home_team_name.localeCompare(b.home_team_name);
  });
};

const generateJSON = (todayMatches: readonly MLSMatch[], yesterdayResults: readonly MatchResult[]): string => {
  const output: MatchesOutput = {
    lastUpdated: new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' }),
    todayMatches,
    yesterdayResults: yesterdayResults.map((r) => {
      const result: MatchResultOutput = {
        match: r.match,
        goalEvents: r.goalEvents.map((e) => {
          const video = e.minute ? findGoalVideo(r.goalVideos, e.side, e.minute) : undefined;
          const event: GoalEventOutput = {
            ...(e.minute !== undefined ? { minute: e.minute } : {}),
            playerName: e.playerName,
            teamName: e.teamName,
            side: e.side,
            isOwnGoal: e.isOwnGoal,
            isShootout: e.isShootout,
            ...(video && { videoUrl: video.url })
          };
          return event;
        })
      };
      return result;
    })
  };

  return JSON.stringify(output);
};

const main = async (): Promise<void> => {
  try {
    const now = getNow();
    const url = getUrl(now);
    const data = await getData(url);

    const todayStr = toETDateStr(now);
    const yesterdayStr = toETDateStr(new Date(now.getTime() - 24 * 60 * 60 * 1000));

    // Use ET date of planned_kickoff_time. start_date is the competition matchday date
    // (shared by all games in a matchweek) and is wrong for date filtering.
    const matchDateStr = (match: MLSMatch): string => toETDateStr(new Date(match.planned_kickoff_time));

    const todayMatches = data.schedule.filter(
      (match) => matchDateStr(match) === todayStr && !EXCLUDED_COMPETITION_IDS.has(match.competition_id)
    );

    const yesterdayMatches = data.schedule.filter(
      (match) => matchDateStr(match) === yesterdayStr && !EXCLUDED_COMPETITION_IDS.has(match.competition_id)
    );

    const sortedTodayMatches = sortMatches(todayMatches);
    const sortedYesterdayMatches = sortMatches(yesterdayMatches);

    const yesterdayResults: readonly MatchResult[] = await Promise.all(
      sortedYesterdayMatches.map(async (match) => {
        if (!match.match_id) {
          return { match, goalEvents: [], goalVideos: [] };
        }
        const [goalEvents, goalVideos] = await Promise.all([
          fetchMatchEvents(match.match_id, match.home_team_name, match.away_team_name),
          fetchGoalVideos(
            match.match_id,
            {
              code: match.home_team_three_letter_code ?? '',
              name: match.home_team_name,
              shortName: match.home_team_short_name ?? ''
            },
            {
              code: match.away_team_three_letter_code ?? '',
              name: match.away_team_name,
              shortName: match.away_team_short_name ?? ''
            }
          )
        ]);
        return { match, goalEvents, goalVideos };
      })
    );

    for (const { match, goalEvents } of yesterdayResults) {
      if (match.match_status !== 'finalWhistle') continue;
      const expectedHome = match.home_team_goals ?? 0;
      const expectedAway = match.away_team_goals ?? 0;
      const eventsHome = goalEvents.filter((e) => e.side === 'home').length;
      const eventsAway = goalEvents.filter((e) => e.side === 'away').length;
      if (eventsHome !== expectedHome || eventsAway !== expectedAway) {
        console.warn(
          `[WARN] Key events count mismatch for ${match.match_id} ` +
            `(${match.home_team_name} vs ${match.away_team_name}): ` +
            `score home=${expectedHome} away=${expectedAway}, ` +
            `events home=${eventsHome} away=${eventsAway}`
        );
      }
    }

    const json = generateJSON(sortedTodayMatches, yesterdayResults);

    await writeFile(join(process.cwd(), 'client', 'public', 'matches.json'), json, 'utf-8');

    console.log('Generated client/public/matches.json successfully');
  } catch (error) {
    console.error('Error generating data:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

void main();
