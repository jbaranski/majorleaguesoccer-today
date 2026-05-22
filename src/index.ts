
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
  readonly match_id?: string;
  readonly start_date?: string;
  readonly match_status?: string;
  readonly home_team_goals?: number | null;
  readonly away_team_goals?: number | null;
  readonly home_team_penalty_goals?: number | null;
  readonly away_team_penalty_goals?: number | null;
  readonly home_team_three_letter_code?: string;
  readonly away_team_three_letter_code?: string;
  [key: string]: unknown;
}

interface MLSMatchResponse {
  readonly schedule: readonly MLSMatch[];
}

interface MatchesOutput {
  readonly lastUpdated: string;
  readonly matches: readonly MLSMatch[];
}

interface GoalVideo {
  readonly title: string;
  readonly url: string;
  readonly side: 'home' | 'away';
}

interface BrightcoveVideoItem {
  readonly slug: string;
  readonly title: string;
  readonly thumbnail: {
    readonly title: string;
    readonly slug: string;
  };
}

interface BrightcoveResponse {
  readonly items: readonly BrightcoveVideoItem[];
}

interface MatchResult {
  readonly match: MLSMatch;
  readonly goalVideos: readonly GoalVideo[];
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

const getNow = (): Date => {
  const mock = process.env['MOCK_DATE'];
  // Use local noon so the ET date matches the date string given, regardless of system timezone
  return mock ? new Date(`${mock}T12:00:00`) : new Date();
};

const toETDateStr = (date: Date): string =>
  date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

const getUrl = (): string => {
  const now = getNow();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const baseUrl = `https://stats-api.mlssoccer.com/matches/seasons/${SEASON}`;
  const params = new URLSearchParams({
    'match_date[gte]': toETDateStr(yesterday),
    'match_date[lte]': toETDateStr(tomorrow),
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

const parseGoalSide = (title: string, homeCode: string, awayCode: string): 'home' | 'away' => {
  // Title: "Goal: [Player] vs. [OpponentCode], [minute]'" — opponent = team that conceded
  // OpponentCode may contain dots (e.g. "D.C."), so capture [A-Z.] and normalize before comparing
  const match = /vs\.\s+([A-Z.]+)/i.exec(title);
  if (match) {
    const opponentCode = match[1]!.replace(/\./g, '').toUpperCase();
    const home = homeCode.replace(/\./g, '').toUpperCase();
    const away = awayCode.replace(/\./g, '').toUpperCase();
    if (opponentCode === home) return 'away';
    if (opponentCode === away) return 'home';
  }
  return 'home';
};

// Some items have malformed thumbnail titles (e.g. "TORgoal (1)") but valid slugs
// like "goal-d-etienne-jr-vs-clt-22". Detect goals by slug pattern as fallback.
const isGoalSlug = (slug: string): boolean => /^(pk-)?goal-/.test(slug);

// Reconstruct a display title from a slug like "goal-d-etienne-jr-vs-clt-22"
const titleFromSlug = (slug: string): string => {
  const isPk = slug.startsWith('pk-goal-');
  const body = slug.slice(isPk ? 'pk-goal-'.length : 'goal-'.length);
  const vsIdx = body.indexOf('-vs-');
  if (vsIdx === -1) return isPk ? 'PK Goal' : 'Goal';
  const playerParts = body.slice(0, vsIdx).split('-');
  const afterVs = body.slice(vsIdx + 4);
  const opponent = afterVs.replace(/-\d+$/, '').replace(/-/g, '').toUpperCase();
  const minute = (/-(\d+)$/.exec(afterVs) ?? [])[1] ?? '';
  const player = playerParts
    .map(p => p.length === 1 ? `${p.toUpperCase()}.` : p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
  const prefix = isPk ? 'PK Goal' : 'Goal';
  return minute ? `${prefix}: ${player} vs. ${opponent}, ${minute}'` : `${prefix}: ${player} vs. ${opponent}`;
};

const fetchGoalVideos = async (matchId: string, homeCode: string, awayCode: string): Promise<readonly GoalVideo[]> => {
  try {
    const url = `https://dapi.mlssoccer.com/v2/content/en-us/brightcovevideos?fields.sportecMatchId=${matchId}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'JEFF-Bot'
      }
    });
    if (!response.ok) return [];

    const data = await response.json() as BrightcoveResponse;

    return data.items
      .filter(item => /^(pk )?goal:/i.test(item.thumbnail?.title ?? '') || isGoalSlug(item.slug))
      .map(item => {
        const title = /^(pk )?goal:/i.test(item.thumbnail?.title ?? '')
          ? item.thumbnail.title
          : titleFromSlug(item.slug);
        return {
          title,
          url: `https://www.mlssoccer.com/video/${item.slug}`,
          side: parseGoalSide(title, homeCode, awayCode)
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

const generateHTML = (todayMatches: readonly MLSMatch[], yesterdayResults: readonly MatchResult[]): string => {
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

  const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      timeZone: 'America/New_York'
    });
  };

  // Group matches by competition
  const groupByCompetition = (matches: readonly MLSMatch[]) =>
    new Map(Object.entries(Object.groupBy(matches, match => match.competition_name)));

  // Generate HTML for today's match cards
  const generateTodayCompetitionsHtml = (matches: readonly MLSMatch[]): string => {
    const matchesByCompetition = groupByCompetition(matches);

    return Array.from(matchesByCompetition.entries()).map(([competitionName, competitionMatches]) => {
      if (!competitionMatches || competitionMatches.length === 0) return '';

      const firstMatch = competitionMatches[0]!;

      return `
    <div class="competition-card">
      <div class="competition-header">
        <div class="header-main">
          <div class="competition-name">${escapeHtml(competitionName)}</div>
          <div class="competition-date">${escapeHtml(formatDate(firstMatch.planned_kickoff_time))}</div>
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
  };

  // Generate HTML for yesterday's results
  const generateYesterdayResultsHtml = (results: readonly MatchResult[]): string => {
    if (results.length === 0) return '';

    const matchesByCompetition = groupByCompetition(results.map(r => r.match));
    const resultsByMatchId = new Map(results.map(r => [r.match.match_id ?? r.match.planned_kickoff_time + r.match.home_team_name, r]));

    const competitionsHtml = Array.from(matchesByCompetition.entries()).map(([competitionName, competitionMatches]) => {
      if (!competitionMatches || competitionMatches.length === 0) return '';

      const firstMatch = competitionMatches[0]!;

      return `
    <div class="competition-card">
      <div class="competition-header results-header">
        <div class="header-main">
          <div class="competition-name">${escapeHtml(competitionName)}</div>
          <div class="competition-date">${escapeHtml(formatDate(firstMatch.planned_kickoff_time))}</div>
        </div>
        <div class="header-meta">
          <span class="match-day">Match Day ${escapeHtml(firstMatch.match_day)}</span>
          <span class="separator">-</span>
          <span class="season">${escapeHtml(firstMatch.season)} Season</span>
        </div>
      </div>
      <div class="matches-list">
        ${competitionMatches.map(match => {
          const key = match.match_id ?? match.planned_kickoff_time + match.home_team_name;
          const result = resultsByMatchId.get(key);
          const goalVideos = result?.goalVideos ?? [];
          const isFinal = match.match_status === 'finalWhistle';
          const homeGoals = match.home_team_goals ?? 0;
          const awayGoals = match.away_team_goals ?? 0;
          const homePk = match.home_team_penalty_goals ?? 0;
          const awayPk = match.away_team_penalty_goals ?? 0;
          const hasPenalties = (homePk > 0 || awayPk > 0) && homeGoals === awayGoals;
          const scoreLabel = isFinal
            ? hasPenalties
              ? `${homeGoals} - ${awayGoals} (PKs: ${homePk}-${awayPk})`
              : `${homeGoals} - ${awayGoals}`
            : '? - ?';

          const homeVideos = goalVideos.filter(g => g.side === 'home');
          const awayVideos = goalVideos.filter(g => g.side === 'away');
          const allGoalItems = [
            ...homeVideos.map(g => `<div class="goal-item"><a href="${escapeHtml(g.url)}" target="_blank" rel="noopener">${escapeHtml(g.title)}</a></div>`),
            ...awayVideos.map(g => `<div class="goal-item goal-item-away"><a href="${escapeHtml(g.url)}" target="_blank" rel="noopener">${escapeHtml(g.title)}</a></div>`),
          ];

          return `
          <div class="match">
            <div class="matchup result-matchup">
              ${isFinal
                ? `<strong class="result-team result-home">${escapeHtml(match.home_team_name)}</strong><span class="score">${escapeHtml(scoreLabel)}</span><strong class="result-team result-away">${escapeHtml(match.away_team_name)}</strong>`
                : `<strong>${escapeHtml(match.home_team_name)} vs ${escapeHtml(match.away_team_name)}</strong><span class="result-unknown">(result unknown)</span>`
              }
            </div>
            ${isFinal && allGoalItems.length > 0 ? `
            <div class="goals-list">
              ${allGoalItems.join('')}
            </div>
            ` : ''}
          </div>
        `;
        }).join('')}
      </div>
    </div>
  `;
    }).join('');

    return `
    <div class="section-header">Yesterday's Results</div>
    ${competitionsHtml}
  `;
  };

  const todayHtml = generateTodayCompetitionsHtml(todayMatches);
  const yesterdayHtml = generateYesterdayResultsHtml(yesterdayResults);

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
        .top-separator {
            border: none;
            border-top: 1px solid #e5e7eb;
            margin: 24px 0;
        }
        .section-header {
            font-size: 1rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #374151;
            margin-bottom: 12px;
            margin-top: 4px;
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
        .results-header {
            background: #ecfdf5;
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
        }
        .result-team {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .result-home {
            text-align: left;
        }
        .result-away {
            text-align: right;
        }
        .score {
            flex-shrink: 0;
            font-size: 16px;
            font-weight: 800;
            color: #111827;
            background: #f3f4f6;
            padding: 2px 8px;
            border-radius: 4px;
        }
        .result-unknown {
            font-size: 13px;
            font-weight: 400;
            color: #9ca3af;
            margin-left: 8px;
        }
        .goals-list {
            margin-top: 6px;
        }
        .goal-item {
            font-size: 13px;
            padding: 2px 0;
        }
        .goal-item a {
            color: #2563eb;
            text-decoration: none;
        }
        .goal-item a:hover {
            text-decoration: underline;
        }
        .goal-item-away {
            text-align: right;
        }
        .goal-no-video {
            color: #6b7280;
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
        ${todayMatches.length > 0
          ? `<div class="section-header">Today's Games</div>${todayHtml}`
          : '<div class="no-games">No games scheduled for today</div>'
        }
        ${yesterdayResults.length > 0 ? `<hr class="section-separator">${yesterdayHtml}` : ''}
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

const generateJSON = (matches: readonly MLSMatch[]): string => {
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

    // Use start_date (the authoritative match-day date) rather than planned_kickoff_time,
    // which crosses UTC midnight for late ET games and would misclassify them.
    const matchDateStr = (match: MLSMatch): string =>
      (match.start_date ?? match.planned_kickoff_time).substring(0, 10);

    const todayMatches = data.schedule.filter(match =>
      matchDateStr(match) === todayStr && !EXCLUDED_COMPETITION_IDS.has(match.competition_id)
    );

    const yesterdayMatches = data.schedule.filter(match =>
      matchDateStr(match) === yesterdayStr && !EXCLUDED_COMPETITION_IDS.has(match.competition_id)
    );

    const sortedTodayMatches = sortMatches(todayMatches);
    const sortedYesterdayMatches = sortMatches(yesterdayMatches);

    const yesterdayResults: readonly MatchResult[] = await Promise.all(
      sortedYesterdayMatches.map(async match => ({
        match,
        goalVideos: match.match_id && match.match_status === 'finalWhistle'
          ? await fetchGoalVideos(
              match.match_id,
              match.home_team_three_letter_code ?? '',
              match.away_team_three_letter_code ?? ''
            )
          : []
      }))
    );

    const html = generateHTML(sortedTodayMatches, yesterdayResults);
    const json = generateJSON(sortedTodayMatches);

    await writeFile(join(process.cwd(), 'index.html'), html, 'utf-8');
    await writeFile(join(process.cwd(), 'client', 'public', 'matches.json'), json, 'utf-8');

    console.log('Generated index.html and client/public/matches.json successfully');
  } catch (error) {
    console.error('Error generating data:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

void main();
