
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

const generateHTML = (matches: readonly MLSMatch[]): string => {
  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York'
    }) + ' ET';
  };

  // Group matches by competition
  const matchesByCompetition = new Map(
    Object.entries(Object.groupBy(matches, match => match.competition_name))
  );

  // Generate HTML for each competition group
  const competitionsHtml = Array.from(matchesByCompetition.entries()).map(([competitionName, competitionMatches]) => {
    if (!competitionMatches || competitionMatches.length === 0) return '';

    // Get match day and season from first match (should be same for all in competition)
    const firstMatch = competitionMatches[0]!;

    // Format the date from the first match
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
          <div class="competition-name">${competitionName}</div>
          <div class="competition-date">${formattedDate}</div>
        </div>
        <div class="header-meta">
          <span class="match-day">Match Day ${firstMatch.match_day}</span>
          <span class="separator">-</span>
          <span class="season">${firstMatch.season} Season</span>
        </div>
      </div>
      <div class="matches-list">
        ${competitionMatches.map(match => `
          <div class="match">
            <div class="matchup">
              <strong>${match.home_team_name} vs ${match.away_team_name}</strong>
            </div>
            <div class="datetime">${formatTime(match.planned_kickoff_time)}</div>
            <div class="venue">
              <div class="stadium">${match.stadium_name}, ${match.stadium_city}, ${match.stadium_country}</div>
              ${match.neutral_venue ? '<div class="details"><span class="neutral">Neutral Venue</span></div>' : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  }).join('');

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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
        }
        h1 {
            color: white;
            text-align: center;
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 40px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .competition-card {
            background: white;
            border-radius: 16px;
            margin-bottom: 32px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            overflow: hidden;
        }
        .competition-header {
            background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
            color: white;
            padding: 18px 24px 12px 24px;
        }
        .header-main {
            margin-bottom: 0;
        }
        .competition-name {
            font-size: 18px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
            line-height: 1.2;
            color: white;
        }
        .competition-date {
            font-size: 16px;
            font-weight: 700;
            font-style: italic;
            color: white;
            margin-bottom: 12px;
        }
        .header-meta {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 0;
        }
        .match-day {
            font-size: 14px;
            font-weight: 700;
            color: #e5e7eb;
        }
        .separator {
            font-size: 14px;
            color: #e5e7eb;
            font-weight: 700;
        }
        .season {
            font-size: 14px;
            font-weight: 700;
            color: #e5e7eb;
        }
        .matches-list {
            padding: 0;
        }
        .match {
            padding: 24px;
            border-bottom: 1px solid #f3f4f6;
            transition: background-color 0.2s ease;
        }
        .match:last-child {
            border-bottom: none;
        }
        .match:hover {
            background: #f9fafb;
        }
        .matchup {
            font-size: 20px;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 12px;
            line-height: 1.2;
        }
        .datetime {
            font-size: 16px;
            font-weight: 600;
            color: #dc2626;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
        }
        .datetime::before {
            content: "🕐";
            margin-right: 8px;
        }
        .venue {
            margin-top: 8px;
        }
        .stadium {
            font-size: 16px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
        }
        .stadium::before {
            content: "🏟️";
            margin-right: 8px;
        }
        .details {
            font-size: 13px;
            color: #6b7280;
            font-weight: 500;
            margin-top: 4px;
        }
        .neutral {
            color: #f59e0b;
            font-weight: 600;
            font-size: 12px;
        }
        .gray {
            color: #9ca3af;
        }
        .last-updated {
            text-align: center;
            color: #9ca3af;
            font-size: 18px;
            font-weight: 500;
            margin-top: 30px;
            opacity: 0.9;
        }
        .source-code {
            text-align: center;
            color: #9ca3af;
            font-size: 14px;
            font-weight: 400;
            margin-top: 20px;
            opacity: 0.9;
        }
        .source-code a {
            text-decoration: none;
            font-weight: 500;
        }
        .source-code a:hover {
            text-decoration: underline;
        }
        .footer-separator {
            border: none;
            border-top: 1px solid #4b5563;
            margin: 15px auto;
            width: 80%;
            opacity: 0.5;
        }
        .footer {
            text-align: center;
            color: #9ca3af;
            font-size: 12px;
            font-weight: 400;
            margin-bottom: 0;
            opacity: 0.8;
        }
        .footer a {
            text-decoration: none;
            font-weight: 500;
        }
        .footer a:hover {
            text-decoration: underline;
        }
        .no-games {
            text-align: center;
            color: white;
            font-size: 18px;
            font-weight: 500;
            margin-top: 20px;
            opacity: 0.9;
        }
        @media (max-width: 640px) {
            .container {
                padding: 0 10px;
            }
            h1 {
                font-size: 2rem;
                margin-bottom: 30px;
            }
            .competition-card {
                margin-bottom: 24px;
            }
            .competition-header {
                padding: 16px 20px 10px 20px;
            }
            .header-main {
                margin-bottom: 0;
            }
            .competition-name {
                font-size: 16px;
                margin-bottom: 10px;
            }
            .competition-date {
                font-size: 14px;
                margin-bottom: 10px;
            }
            .header-meta {
                gap: 8px;
                margin-bottom: 0;
            }
            .match-day {
                font-size: 12px;
            }
            .separator {
                font-size: 12px;
            }
            .season {
                font-size: 12px;
            }
            .match {
                padding: 20px;
            }
            .matchup {
                font-size: 18px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Major League Soccer Today</h1>
        ${matches.length > 0 ? competitionsHtml : '<div class="no-games">No games scheduled for today</div>'}
        <div class="last-updated">Last updated: <em>${new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' })}</em></div>
        <div class="source-code">
          <a href="https://github.com/jbaranski/majorleaguesoccer-today" target="_blank" rel="noopener">Source code</a> used to generate the daily fixture list is free and open source :)
        </div>
        <hr class="footer-separator">
        <div class="footer">
          Copyright 2025 Jeff Software |
          <a href="mailto:admin@jeffsoftware.com">admin@jeffsoftware.com</a> |
          <a href="https://twitter.com/jeffsoftware" target="_blank" rel="noopener">@jeffsoftware</a>
        </div>
    </div>
</body>
</html>`;
};

const main = async (): Promise<void> => {
  try {
    const url = getUrl();
    const data = await getData(url);

    // Filter to today's 24-hour period and exclude unwanted competitions
    // (must go a little wider fetching data or we can miss games depending on time of day run)
    const now = new Date();
    const startOfToday = new Date(now.toDateString());
    const endOfToday = new Date(startOfToday.getTime() + (24 * 60 * 60 * 1000) - 1);

    const filteredData = data.schedule.filter(match => {
      const matchTime = new Date(match.planned_kickoff_time);
      const isToday = matchTime >= startOfToday && matchTime <= endOfToday;
      const isAllowedCompetition = !EXCLUDED_COMPETITION_IDS.has(match.competition_id);
      return isToday && isAllowedCompetition;
    });

    const sortedData = filteredData.sort((a, b) => {
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

    const html = generateHTML(sortedData);
    await writeFile(join(process.cwd(), 'index.html'), html, 'utf-8');
  } catch (error) {
    console.error('Error generating data:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

void main();
