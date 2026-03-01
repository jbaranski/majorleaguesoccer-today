
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
  readonly match_id: string;
  readonly match_status: string;
  readonly home_team_goals: number;
  readonly away_team_goals: number;
  readonly result: string;
  [key: string]: unknown;
}

interface MLSMatchResponse {
  readonly schedule: readonly MLSMatch[];
}

interface GoalEvent {
  readonly minute: number;
  readonly player_name: string;
  readonly team_id: string;
  readonly team_name: string;
  readonly is_own_goal: boolean;
  readonly is_penalty: boolean;
  readonly video_url?: string;
  [key: string]: unknown;
}

// The MLS stats API match events response format
interface MLSMatchEventsResponse {
  readonly data?: readonly GoalEvent[];
  readonly events?: readonly GoalEvent[];
  readonly goals?: readonly GoalEvent[];
  [key: string]: unknown;
}

// MLS content API video item
interface MLSVideoItem {
  readonly title?: string;
  readonly slug?: string;
  readonly contentUrl?: string;
  readonly url?: string;
  readonly tags?: readonly { slug?: string; name?: string }[];
  readonly contentDate?: string;
  readonly date?: string;
  [key: string]: unknown;
}

interface MLSVideoResponse {
  readonly data?: readonly MLSVideoItem[];
  readonly content?: readonly MLSVideoItem[];
  readonly hits?: readonly MLSVideoItem[];
  readonly results?: readonly MLSVideoItem[];
  [key: string]: unknown;
}

interface PreviousResult {
  readonly match: MLSMatch;
  readonly goals: readonly GoalEvent[];
}

interface MatchesOutput {
  readonly lastUpdated: string;
  readonly matches: readonly MLSMatch[];
  readonly previousResults: readonly PreviousResult[];
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

const COMPLETED_STATUSES = new Set([
  'full-time',
  'final',
  'completed',
  'fulltime',
  'ft',
  'post-match',
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

// Fetch goal videos from MLS Soccer content API (goals topic, topic ID 2)
const getGoalVideos = async (): Promise<MLSVideoItem[]> => {
  // MLS Soccer's content API serves the goals video topic page at /video/topics/goals/2
  const url = 'https://www.mlssoccer.com/api/content/v3/search?types=video&topicIds=2&count=50&page=1&order=desc';
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'JEFF-Bot'
      }
    });

    if (!response.ok) {
      console.warn(`Goal videos API returned ${response.status}, skipping video links`);
      return [];
    }

    const data = await response.json() as MLSVideoResponse;

    // Handle various possible response envelope formats
    const items = data.data ?? data.content ?? data.hits ?? data.results;
    if (Array.isArray(items)) {
      return items as MLSVideoItem[];
    }
    return [];
  } catch (err) {
    console.warn('Failed to fetch goal videos:', err instanceof Error ? err.message : String(err));
    return [];
  }
};

// Try to fetch individual goal events for a completed match from the stats API
const getMatchGoalEvents = async (matchId: string): Promise<GoalEvent[]> => {
  const url = `https://stats-api.mlssoccer.com/matches/${matchId}/events`;
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'JEFF-Bot'
      }
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json() as MLSMatchEventsResponse;

    // Extract goal events from whatever field they come in
    const events = data.data ?? data.events ?? data.goals ?? [];
    if (!Array.isArray(events)) return [];

    return (events as GoalEvent[]).filter(e => {
      const type = String(e['type'] ?? e['event_type'] ?? '').toLowerCase();
      return type === 'goal' || type === 'own_goal' || type === 'penalty_goal';
    });
  } catch {
    return [];
  }
};

// Resolve a video URL for a given video item
const resolveVideoUrl = (video: MLSVideoItem): string | undefined => {
  const path = video.slug ?? video.contentUrl ?? video.url ?? '';
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  return `https://www.mlssoccer.com${path.startsWith('/') ? '' : '/'}${path}`;
};

// Match goal videos to a specific match by looking for both team names in video titles/tags
const findVideosForMatch = (
  videos: MLSVideoItem[],
  homeTeamName: string,
  awayTeamName: string
): MLSVideoItem[] => {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '');

  // Build keyword sets from team names (last word often most distinctive)
  const homeWords = homeTeamName.split(' ').map(normalize).filter(w => w.length > 2);
  const awayWords = awayTeamName.split(' ').map(normalize).filter(w => w.length > 2);

  return videos.filter(video => {
    const title = normalize(video.title ?? '');
    const tagSlugs = (video.tags ?? []).map(t => normalize(t.slug ?? t.name ?? ''));
    const searchable = [title, ...tagSlugs].join(' ');

    const matchesHome = homeWords.some(w => searchable.includes(w));
    const matchesAway = awayWords.some(w => searchable.includes(w));
    return matchesHome || matchesAway;
  });
};

// Combine goal event data with matching videos
const buildGoalEventsWithVideos = (
  goalEvents: GoalEvent[],
  matchVideos: MLSVideoItem[]
): GoalEvent[] => {
  if (goalEvents.length === 0) {
    // No event data: surface one video per match as a general highlights link
    return matchVideos.slice(0, 1).map(video => {
      const videoUrl = resolveVideoUrl(video);
      return {
        minute: 0,
        player_name: '',
        team_id: '',
        team_name: '',
        is_own_goal: false as const,
        is_penalty: false as const,
        ...(videoUrl !== undefined ? { video_url: videoUrl } : {}),
      };
    });
  }

  // Pair each goal event with the corresponding video (by order)
  return goalEvents.map((event, idx) => {
    const fallback = matchVideos.length > 0 ? matchVideos[Math.min(idx, matchVideos.length - 1)] : undefined;
    const videoUrl = fallback !== undefined ? resolveVideoUrl(fallback) : undefined;
    return {
      ...event,
      ...(videoUrl !== undefined ? { video_url: videoUrl } : {}),
    };
  });
};

const generateHTML = (
  todayMatches: readonly MLSMatch[],
  previousResults: readonly PreviousResult[]
): string => {
  const escapeHtml = (str: string | number): string => {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York'
    }) + ' ET';
  };

  // Group today's matches by competition
  const matchesByCompetition = new Map(
    Object.entries(Object.groupBy(todayMatches, match => match.competition_name))
  );

  const todayCompetitionsHtml = Array.from(matchesByCompetition.entries()).map(([competitionName, competitionMatches]) => {
    if (!competitionMatches || competitionMatches.length === 0) return '';

    const firstMatch = competitionMatches[0]!;
    const matchDate = new Date(firstMatch.planned_kickoff_time);
    const formattedDate = matchDate.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      timeZone: 'America/New_York'
    });

    return `
    <div class="competition-card">
      <div class="competition-header">
        <div class="header-main">
          <div class="competition-name">${escapeHtml(competitionName)}</div>
          <div class="competition-date">${escapeHtml(formattedDate)}</div>
        </div>
        <div class="header-meta">
          <span class="match-day">Match Day ${escapeHtml(firstMatch.match_day)}</span>
          <span class="separator">-</span>
          <span class="season">${escapeHtml(firstMatch.season)} Season</span>
        </div>
      </div>
      <div class="matches-list">
        ${competitionMatches.map(match => `
          <div class="match">
            <div class="matchup">
              <strong>${escapeHtml(match.home_team_name)} vs ${escapeHtml(match.away_team_name)}</strong>
            </div>
            <div class="datetime">${escapeHtml(formatTime(match.planned_kickoff_time))}</div>
            <div class="venue">
              <div class="stadium">${escapeHtml(match.stadium_name)}, ${escapeHtml(match.stadium_city)}, ${escapeHtml(match.stadium_country)}</div>
              ${match.neutral_venue ? '<div class="details"><span class="neutral">Neutral Venue</span></div>' : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  }).join('');

  // Group previous results by competition
  const resultsByCompetition = new Map<string, PreviousResult[]>();
  for (const result of previousResults) {
    const key = result.match.competition_name;
    if (!resultsByCompetition.has(key)) resultsByCompetition.set(key, []);
    resultsByCompetition.get(key)!.push(result);
  }

  const previousResultsHtml = previousResults.length === 0 ? '' : `
    <h2 class="section-title">Yesterday&#39;s Results</h2>
    ${Array.from(resultsByCompetition.entries()).map(([competitionName, results]) => {
      const firstMatch = results[0]!.match;
      const matchDate = new Date(firstMatch.planned_kickoff_time);
      const formattedDate = matchDate.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        timeZone: 'America/New_York'
      });

      return `
    <div class="competition-card results-card">
      <div class="competition-header results-header">
        <div class="header-main">
          <div class="competition-name">${escapeHtml(competitionName)}</div>
          <div class="competition-date">${escapeHtml(formattedDate)}</div>
        </div>
        <div class="header-meta">
          <span class="match-day">Match Day ${escapeHtml(firstMatch.match_day)}</span>
          <span class="separator">-</span>
          <span class="season">${escapeHtml(firstMatch.season)} Season</span>
        </div>
      </div>
      <div class="matches-list">
        ${results.map(({ match, goals }) => {
          const goalLinksHtml = goals.length === 0 ? '' : `
            <div class="goal-links">
              ${goals.map(g => {
                const label = g.player_name
                  ? `\u26BD ${escapeHtml(g.player_name)}${g.minute > 0 ? ` ${escapeHtml(g.minute)}'` : ''}${g.is_own_goal ? ' (OG)' : ''}${g.is_penalty ? ' (P)' : ''}`
                  : `\u26BD Goals`;
                return g.video_url
                  ? `<a href="${escapeHtml(g.video_url)}" class="goal-link" target="_blank" rel="noopener">${label}</a>`
                  : `<span class="goal-item">${label}</span>`;
              }).join('')}
            </div>`;

          return `
          <div class="match">
            <div class="matchup result-matchup">
              <strong>${escapeHtml(match.home_team_name)}</strong>
              <span class="score">${escapeHtml(match.home_team_goals)} \u2013 ${escapeHtml(match.away_team_goals)}</span>
              <strong>${escapeHtml(match.away_team_name)}</strong>
            </div>
            ${goalLinksHtml}
          </div>`;
        }).join('')}
      </div>
    </div>`;
    }).join('')}
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-XG4BHHWJXS"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      gtag('config', 'G-XG4BHHWJXS');
    </script>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Major League Soccer Today</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: #ffffff;
            min-height: 100vh;
            padding: 16px;
            color: #1f2937;
        }
        .container {
            max-width: 672px;
            margin: 0 auto;
        }
        h1 {
            color: #1f2937;
            text-align: center;
            font-size: 1.875rem;
            font-weight: 700;
            margin-bottom: 8px;
        }
        .section-title {
            color: #1f2937;
            font-size: 1.125rem;
            font-weight: 700;
            margin-bottom: 12px;
            margin-top: 8px;
            padding-bottom: 4px;
            border-bottom: 1px solid #e5e7eb;
        }
        .top-separator {
            border: none;
            border-top: 1px solid #e5e7eb;
            margin: 24px 0;
        }
        .section-separator {
            border: none;
            border-top: 1px solid #e5e7eb;
            margin: 24px 0 16px 0;
        }
        .competition-card {
            border: 2px solid #e5e7eb;
            margin-bottom: 16px;
            overflow: hidden;
        }
        .competition-header {
            background: #f3e8ff;
            padding: 12px 16px 8px 16px;
            border-bottom: 2px solid #e5e7eb;
        }
        .results-card {
            border-color: #d1d5db;
        }
        .results-header {
            background: #f1f5f9;
        }
        .header-main {
            margin-bottom: 0;
        }
        .competition-name {
            font-size: 14px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
            line-height: 1.2;
            color: #1f2937;
        }
        .competition-date {
            font-size: 14px;
            font-weight: 400;
            font-style: italic;
            color: #4b5563;
            margin-bottom: 4px;
        }
        .header-meta {
            display: flex;
            gap: 8px;
            align-items: center;
            margin-bottom: 0;
        }
        .match-day {
            font-size: 12px;
            font-weight: 500;
            color: #6b7280;
        }
        .separator {
            font-size: 12px;
            color: #6b7280;
            font-weight: 500;
        }
        .season {
            font-size: 12px;
            font-weight: 500;
            color: #6b7280;
        }
        .matches-list {
            padding: 0;
        }
        .match {
            padding: 12px 16px;
            border-bottom: 2px solid #e5e7eb;
            transition: background-color 0.2s ease;
        }
        .match:last-child {
            border-bottom: none;
        }
        .match:hover {
            background: #f9fafb;
        }
        .matchup {
            font-size: 14px;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 4px;
            line-height: 1.4;
        }
        .result-matchup {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }
        .score {
            font-size: 15px;
            font-weight: 800;
            color: #111827;
            letter-spacing: 0.5px;
            white-space: nowrap;
        }
        .goal-links {
            margin-top: 6px;
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        .goal-link {
            font-size: 11px;
            color: #6b7280;
            text-decoration: none;
            font-weight: 400;
        }
        .goal-link:hover {
            color: #3b82f6;
            text-decoration: underline;
        }
        .goal-item {
            font-size: 11px;
            color: #6b7280;
            font-weight: 400;
        }
        .datetime {
            font-size: 13px;
            font-weight: 500;
            color: #4b5563;
            margin-bottom: 4px;
        }
        .venue {
            margin-top: 2px;
        }
        .stadium {
            font-size: 13px;
            font-weight: 400;
            color: #6b7280;
            margin-bottom: 4px;
        }
        .details {
            font-size: 12px;
            color: #6b7280;
            font-weight: 500;
            margin-top: 2px;
        }
        .neutral {
            color: #d97706;
            font-weight: 600;
            font-size: 12px;
        }
        .gray {
            color: #9ca3af;
        }
        .last-updated {
            text-align: center;
            color: #6b7280;
            font-size: 14px;
            font-weight: 400;
            margin-top: 16px;
            margin-bottom: 8px;
        }
        .source-code {
            text-align: center;
            color: #6b7280;
            font-size: 14px;
            font-weight: 400;
            margin-top: 16px;
        }
        .source-code a {
            color: #3b82f6;
            text-decoration: none;
            font-weight: 400;
        }
        .source-code a:hover {
            text-decoration: underline;
        }
        .footer-separator {
            border: none;
            border-top: 1px solid #e5e7eb;
            margin: 16px 0;
        }
        .footer {
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            font-weight: 300;
            margin-bottom: 0;
        }
        .footer a {
            color: #3b82f6;
            text-decoration: none;
            font-weight: 400;
        }
        .footer a:hover {
            text-decoration: underline;
        }
        .no-games {
            text-align: center;
            color: #6b7280;
            font-size: 14px;
            font-weight: 400;
            margin-top: 16px;
        }
        @media (max-width: 640px) {
            .container {
                padding: 0 8px;
            }
            h1 {
                font-size: 1.5rem;
            }
            .competition-header {
                padding: 10px 12px 6px 12px;
            }
            .match {
                padding: 10px 12px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Major League Soccer Today</h1>
        <hr class="top-separator">
        <div class="last-updated">Last updated: ${new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' })}</div>
        ${todayMatches.length > 0 ? todayCompetitionsHtml : '<div class="no-games">No games scheduled for today</div>'}
        ${previousResults.length > 0 ? `<hr class="section-separator">${previousResultsHtml}` : ''}
        <div class="source-code">
          View on the web at <a href="https://mlstoday.jeffsoftware.com" target="_blank" rel="noopener">mlstoday.jeffsoftware.com</a>
        </div>
        <div class="source-code">
          <a href="https://github.com/jbaranski/majorleaguesoccer-today" target="_blank" rel="noopener">Source code</a> used to generate the daily fixture list is free and open source :)
        </div>
        <hr class="footer-separator">
        <div class="footer">
          Copyright 2025,2026 Jeff Software |
          <a href="mailto:mlstoday@jeffsoftware.com">mlstoday@jeffsoftware.com</a> |
          <a href="https://twitter.com/jeffsoftware" target="_blank" rel="noopener">@jeffsoftware</a> |
          <a href="{{UNSUBSCRIBE_URL}}">Unsubscribe</a>
        </div>
    </div>
</body>
</html>`;
};

const generateJSON = (
  matches: readonly MLSMatch[],
  previousResults: readonly PreviousResult[]
): string => {
  const output: MatchesOutput = {
    lastUpdated: new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' }),
    matches,
    previousResults
  };

  return JSON.stringify(output);
};

const main = async (): Promise<void> => {
  try {
    const url = getUrl();
    const data = await getData(url);

    const now = new Date();
    const startOfToday = new Date(now.toDateString());
    const endOfToday = new Date(startOfToday.getTime() + (24 * 60 * 60 * 1000) - 1);
    const startOfYesterday = new Date(startOfToday.getTime() - (24 * 60 * 60 * 1000));

    // Split fetched matches into today's scheduled and yesterday's completed
    const todayMatches = data.schedule.filter(match => {
      const matchTime = new Date(match.planned_kickoff_time);
      const isToday = matchTime >= startOfToday && matchTime <= endOfToday;
      const isAllowedCompetition = !EXCLUDED_COMPETITION_IDS.has(match.competition_id);
      return isToday && isAllowedCompetition;
    });

    const yesterdayCompleted = data.schedule.filter(match => {
      const matchTime = new Date(match.planned_kickoff_time);
      const isYesterday = matchTime >= startOfYesterday && matchTime < startOfToday;
      const isAllowedCompetition = !EXCLUDED_COMPETITION_IDS.has(match.competition_id);
      const isCompleted = COMPLETED_STATUSES.has(match.match_status?.toLowerCase() ?? '');
      return isYesterday && isAllowedCompetition && isCompleted;
    });

    const sortMatches = (matches: MLSMatch[]): MLSMatch[] =>
      matches.sort((a, b) => {
        const priorityComparison = getCompetitionPriority(a.competition_id) - getCompetitionPriority(b.competition_id);
        if (priorityComparison !== 0) return priorityComparison;

        const timeComparison = a.planned_kickoff_time.localeCompare(b.planned_kickoff_time);
        if (timeComparison !== 0) return timeComparison;

        return a.home_team_name.localeCompare(b.home_team_name);
      });

    const sortedTodayMatches = sortMatches([...todayMatches]);
    const sortedYesterdayCompleted = sortMatches([...yesterdayCompleted]);

    // Fetch goal videos (non-blocking, graceful fallback)
    const goalVideos = await getGoalVideos();

    // Build previous results with goal event data and matched video URLs
    const previousResults: PreviousResult[] = await Promise.all(
      sortedYesterdayCompleted.map(async (match) => {
        const matchVideos = findVideosForMatch(goalVideos, match.home_team_name, match.away_team_name);

        // Try to fetch individual goal events from the stats API
        let goalEvents = await getMatchGoalEvents(match.match_id);

        // Combine goal events with video links
        const goals = buildGoalEventsWithVideos(goalEvents, matchVideos);

        return { match, goals };
      })
    );

    const html = generateHTML(sortedTodayMatches, previousResults);
    const json = generateJSON(sortedTodayMatches, previousResults);

    await writeFile(join(process.cwd(), 'index.html'), html, 'utf-8');
    await writeFile(join(process.cwd(), 'client', 'public', 'matches.json'), json, 'utf-8');

    console.log('Generated index.html and client/public/matches.json successfully');
  } catch (error) {
    console.error('Error generating data:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

void main();
