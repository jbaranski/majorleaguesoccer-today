
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

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
  [key: string]: unknown;
}

interface MLSMatchResponse {
  readonly schedule: readonly MLSMatch[];
}

interface MatchesOutput {
  readonly lastUpdated: string;
  readonly matches: readonly MLSMatch[];
}

// TODO: Input via Actions
const SEASON = 'MLS-SEA-0001KA';

// TODO: Input via Actions
const EXCLUDED_COMPETITION_IDS = new Set([
  'MLS-COM-000003',
  'MLS-COM-000004',
  'MLS-COM-00002R',
  'MLS-COM-00002X'
]);

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
  ['MLS-COM-00002S', 12], // Club Friendly Matches
]);

const getCompetitionPriority = (competitionId: string): number => {
  return COMPETITION_PRIORITIES.get(competitionId) ?? Number.MAX_SAFE_INTEGER;
};

const getUrl = (): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const baseUrl = `https://stats-api.mlssoccer.com/matches/seasons/${SEASON}`;
  const params = new URLSearchParams({
    'match_date[gte]': yesterday.toLocaleDateString('en-CA'), // Returns YYYY-MM-DD format
    'match_date[lte]': tomorrow.toLocaleDateString('en-CA'), // Returns YYYY-MM-DD format
    'per_page': '1000',
    'sort': 'planned_kickoff_time:asc,home_team_name:asc'
  });

  return `${baseUrl}?${params.toString()}`;
};

const getData = async (url: string): Promise<MLSMatchResponse> => {
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'JEFF-Bot'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json() as MLSMatchResponse;
};

const fetchMatchEvents = async (matchId: string, homeTeamName: string, awayTeamName: string): Promise<readonly GoalEvent[]> => {
  try {
    const url = `https://stats-api.mlssoccer.com/matches/${matchId}/key_events?per_page=1000`;
    const response = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'JEFF-Bot' } });
    if (!response.ok) return [];
    const data = await response.json() as KeyEventsResponse;
    return data.events
      .filter(e => e.sub_type === 'goals' || e.type === 'own_goals')
      .map(e => {
        const isOwnGoal = e.type === 'own_goals';
        // Penalty events nest the actual scorer inside shot_at_goal; regular goals are at event level
        const scorer: KeyEventScorer = e.event.shot_at_goal ?? e.event;
        const fullName = `${scorer.player_first_name ?? ''} ${scorer.player_last_name ?? ''}`.trim();
        const scoringTeamName = scorer.team_name;
        // For own goals the player's team conceded, so the scoring side is the opponent
        const scoringTeam = isOwnGoal
          ? (scoringTeamName === homeTeamName ? awayTeamName : homeTeamName)
          : scoringTeamName;
        return {
          minute: e.event.minute_of_play,
          playerName: fullName || scorer.player_alias || 'Unknown',
          teamName: scoringTeamName,
          side: scoringTeam === homeTeamName ? 'home' : 'away',
          isOwnGoal
        };
      });
  } catch {
    return [];
  }
};

const fetchGoalVideos = async (matchId: string, homeCode: string, awayCode: string): Promise<readonly GoalVideo[]> => {
  try {
    const url = `https://dapi.mlssoccer.com/v2/content/en-us/brightcovevideos?fields.sportecMatchId=${matchId}`;
    const response = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'JEFF-Bot' } });
    if (!response.ok) return [];
    const data = await response.json() as BrightcoveResponse;

    // Determine side from title "vs. [OpponentCode]" or from slug "goal-...-vs-{code}-{minute}"
    const extractOpponentCode = (title: string, slug: string): string => {
      const titleMatch = /vs\.\s+([A-Z.]+)/i.exec(title);
      if (titleMatch) return titleMatch[1]!.replace(/\./g, '').toUpperCase();
      const vsIdx = slug.indexOf('-vs-');
      if (vsIdx !== -1) return slug.slice(vsIdx + 4).replace(/-\d+$/, '').replace(/-/g, '').toUpperCase();
      return '';
    };

    const sideFromOpponent = (opponentCode: string): 'home' | 'away' => {
      const home = homeCode.replace(/\./g, '').toUpperCase();
      const away = awayCode.replace(/\./g, '').toUpperCase();
      if (opponentCode === home) return 'away';
      if (opponentCode === away) return 'home';
      return 'home';
    };

    const minuteFromTitle = (title: string): string =>
      (/,\s*(\d+(?:\+\d+)?)'/.exec(title) ?? [])[1] ?? '';
    // Slug format: "goal-player-vs-team-45-1" (injury time) or "goal-player-vs-team-82"
    // After -vs-, strip team code (letters) then take the remaining digits, converting
    // hyphen-separated extra time back to "45+1" form.
    const minuteFromSlug = (slug: string): string => {
      const vsIdx = slug.indexOf('-vs-');
      if (vsIdx === -1) return '';
      const afterVs = slug.slice(vsIdx + 4);
      const m = /(\d+(?:-\d+)?)$/.exec(afterVs);
      return m ? m[1]!.replace(/-(\d+)$/, '+$1') : '';
    };

    return data.items
      .filter(item => /^(pk )?goal:/i.test(item.thumbnail?.title ?? '') || /^(pk-)?goal-/.test(item.slug))
      .map(item => {
        const title = item.thumbnail?.title ?? '';
        const opponentCode = extractOpponentCode(title, item.slug);
        const minute = minuteFromTitle(title) || minuteFromSlug(item.slug);
        return {
          url: `https://www.mlssoccer.com/video/${item.slug}`,
          minute,
          side: sideFromOpponent(opponentCode)
        };
      });
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
  const minutesClose = (a: string, b: string): boolean =>
    a === b || Math.abs(parseInt(a) - parseInt(b)) <= 5;

  const output: MatchesOutput = {
    lastUpdated: new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' }),
    matches
  };

  return JSON.stringify(output);
};

const main = async (): Promise<void> => {
  try {
    const url = getUrl();
    const data = await getData(url);

    const now = getNow();
    const todayStr = toETDateStr(now);
    const yesterdayStr = toETDateStr(new Date(now.getTime() - 24 * 60 * 60 * 1000));

    // Use ET date of planned_kickoff_time. start_date is the competition matchday date
    // (shared by all games in a matchweek) and is wrong for date filtering.
    const matchDateStr = (match: MLSMatch): string =>
      toETDateStr(new Date(match.planned_kickoff_time));

    const todayMatches = data.schedule.filter(match =>
      matchDateStr(match) === todayStr && !EXCLUDED_COMPETITION_IDS.has(match.competition_id)
    );

    const yesterdayMatches = data.schedule.filter(match =>
      matchDateStr(match) === yesterdayStr && !EXCLUDED_COMPETITION_IDS.has(match.competition_id)
    );

    const sortedTodayMatches = sortMatches(todayMatches);
    const sortedYesterdayMatches = sortMatches(yesterdayMatches);

    const yesterdayResults: readonly MatchResult[] = await Promise.all(
      sortedYesterdayMatches.map(async match => {
        if (!match.match_id) {
          return { match, goalEvents: [], goalVideos: [] };
        }
        const [goalEvents, goalVideos] = await Promise.all([
          fetchMatchEvents(match.match_id, match.home_team_name, match.away_team_name),
          fetchGoalVideos(match.match_id, match.home_team_three_letter_code ?? '', match.away_team_three_letter_code ?? '')
        ]);
        return { match, goalEvents, goalVideos };
      })
    );

    const json = generateJSON(sortedTodayMatches, yesterdayResults);

    for (const { match, goalEvents, goalVideos } of yesterdayResults) {
      if (match.match_status !== 'finalWhistle') continue;
      const expectedHome = match.home_team_goals ?? 0;
      const expectedAway = match.away_team_goals ?? 0;
      const eventsHome = goalEvents.filter(e => e.side === 'home').length;
      const eventsAway = goalEvents.filter(e => e.side === 'away').length;
      if (eventsHome !== expectedHome || eventsAway !== expectedAway) {
        console.warn(
          `[WARN] Key events count mismatch for ${match.match_id} ` +
          `(${match.home_team_name} vs ${match.away_team_name}): ` +
          `score home=${expectedHome} away=${expectedAway}, ` +
          `events home=${eventsHome} away=${eventsAway}`
        );
      }

    await writeFile(join(process.cwd(), 'client', 'public', 'matches.json'), json, 'utf-8');

    console.log('Generated client/public/matches.json successfully');
  } catch (error) {
    console.error('Error generating data:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

void main();
