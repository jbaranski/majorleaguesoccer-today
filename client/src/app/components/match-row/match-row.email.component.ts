import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { MLSMatch, GoalEvent } from '../../models/mls-match.model';
import { MatchFormatter } from '../../utils/match-formatter';

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif`;
const TD_TEAM = `width: 40%; padding: 10px 12px; vertical-align: middle; font-size: 16px; font-weight: bold; color: #111827; font-family: ${FONT};`;
const TD_BADGE = `width: 20%; padding: 10px 4px; vertical-align: middle; text-align: center; font-family: ${FONT};`;
const BADGE = `display: inline-block; background: #f3f4f6; padding: 2px 8px; border-radius: 4px; font-size: 16px; font-weight: bold; color: #111827; white-space: nowrap;`;
const VENUE = `font-size: 13px; color: #6b7280; padding: 0 12px 8px; font-family: ${FONT};`;
const GOAL = `font-size: 14px; color: #374151; font-family: ${FONT};`;

@Component({
  selector: 'app-match-row',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.display]': '"block"' },
  template: `
    <div style="border-bottom: 2px solid #e5e7eb;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="${TD_TEAM} text-align: left;">{{ match().home_team_name }}</td>
          <td style="${TD_BADGE}">
            <span style="${BADGE}">
              @if (isResult()) { {{ scoreLabel() }} } @else { {{ formatTime(match().planned_kickoff_time) }} }
            </span>
          </td>
          <td style="${TD_TEAM} text-align: right;">{{ match().away_team_name }}</td>
        </tr>
      </table>
      <div style="${VENUE}">{{ match().stadium_name }}, {{ match().stadium_city }}, {{ match().stadium_country }}</div>
      @if (match().neutral_venue) {
        <div style="font-size: 13px; font-weight: 600; color: #d97706; padding: 0 12px 8px; font-family: ${FONT};">Neutral Venue</div>
      }
      @if (isResult() && goalEvents().length > 0) {
        <div style="padding: 0 12px 8px;">
          @for (goal of goalEvents(); track $index) {
            <div style="${GOAL}" [style.text-align]="goal.side === 'away' ? 'right' : 'left'">
              @if (goal.videoUrl) {
                <a [href]="goal.videoUrl" target="_blank" rel="noopener" style="color: #2563eb; text-decoration: none;">{{ goalLabel(goal) }}</a>
              } @else {
                {{ goalLabel(goal) }}
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class MatchRowComponent {
  match = input.required<MLSMatch>();
  goalEvents = input<readonly GoalEvent[]>([]);
  isResult = input<boolean>(false);

  scoreLabel = computed(() => {
    const m = this.match();
    const home = m.home_team_goals ?? 0;
    const away = m.away_team_goals ?? 0;
    const homePk = m.home_team_penalty_goals ?? 0;
    const awayPk = m.away_team_penalty_goals ?? 0;
    if (m.home_team_goals == null || m.away_team_goals == null) return '? - ?';
    if ((homePk > 0 || awayPk > 0) && home === away) return `${home} - ${away} (PKs: ${homePk}-${awayPk})`;
    return `${home} - ${away}`;
  });

  goalLabel(goal: GoalEvent): string {
    if (goal.isShootout) return `${goal.playerName} (PK shootout scorer)`;
    const minutePart = goal.minute ? `, ${goal.minute}'` : '';
    return `${goal.playerName}${goal.isOwnGoal ? ' (OG)' : ''}${minutePart}`;
  }

  formatTime(isoString: string): string {
    return MatchFormatter.formatTime(isoString);
  }
}
