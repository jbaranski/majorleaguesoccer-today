
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

interface MLSMatch {
  readonly competition_id: string;
  readonly competition_name: string;
  readonly home_team_name: string;
  readonly away_team_name: string;
  readonly planned_kickoff_time: string;
  readonly match_status: string;
  readonly stadium_name: string;
  readonly stadium_city: string;
  readonly stadium_country: string;
  readonly match_day: number;
  readonly match_type: string;
  readonly season: number;
  readonly neutral_venue: boolean;
  [key: string]: unknown;
}

interface MLSMatchResponse {
  readonly schedule: readonly MLSMatch[];
}

const SEASON = 'MLS-SEA-0001K9';

const EXCLUDED_COMPETITION_IDS = new Set([
  'MLS-COM-000003',
  'MLS-COM-000004',
  'MLS-COM-00002R',
  'MLS-COM-00002X'
]);


const getUrl = (): string => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const baseUrl = `https://stats-api.mlssoccer.com/matches/seasons/${SEASON}`;
  const params = new URLSearchParams({
    'match_date[gte]': today.toLocaleDateString('en-CA'), // Returns YYYY-MM-DD format
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
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York'
    }).replace(',', '') + ' ET';
  };

  const matchesHtml = matches.map(match => `
    <div class="match">
      <div class="competition">${match.competition_name}</div>
      <div class="matchup">
        <strong>${match.home_team_name} vs ${match.away_team_name}</strong>
      </div>
      <div class="datetime">${formatTime(match.planned_kickoff_time)}</div>
      <div class="venue">
        <div class="stadium">${match.stadium_name}, ${match.stadium_city}, ${match.stadium_country}</div>
        <div class="details">
          <span class="gray">Match Day ${match.match_day}</span> •
          <span class="gray">${match.season} Season</span>
          ${match.neutral_venue ? ' • <span class="gray">Neutral Venue</span>' : ''}
        </div>
      </div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Major League Soccer Today</title>
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
        .match {
            background: white;
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .match:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 40px rgba(0,0,0,0.15);
        }
        .competition {
            font-size: 12px;
            color: #8b5cf6;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
        }
        .matchup {
            font-size: 24px;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 16px;
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
            border-top: 1px solid #e5e7eb;
            padding-top: 16px;
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
        }
        .gray {
            color: #9ca3af;
        }
        .no-games {
            text-align: center;
            color: white;
            font-size: 18px;
            font-weight: 500;
            margin-top: 100px;
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
            .match {
                padding: 20px;
                margin-bottom: 16px;
            }
            .matchup {
                font-size: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Major League Soccer Today</h1>
        ${matches.length > 0 ? matchesHtml : '<div class="no-games">No games scheduled for today</div>'}
    </div>
</body>
</html>`;
};

const main = async (): Promise<void> => {
  try {
    const url = getUrl();
    const data = await getData(url);

    const filteredData = data.schedule.filter(
      match => !EXCLUDED_COMPETITION_IDS.has(match.competition_id)
    );

    const sortedData = filteredData.sort((a, b) => {
      const timeComparison = a.planned_kickoff_time.localeCompare(b.planned_kickoff_time);
      if (timeComparison !== 0) return timeComparison;
      return a.home_team_name.localeCompare(b.home_team_name);
    });

    const html = generateHTML(sortedData);
    await writeFile(join(process.cwd(), 'today.html'), html, 'utf-8');
  } catch (error) {
    console.error('Error fetching data:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

void main();