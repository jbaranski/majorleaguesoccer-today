import { Component, input } from '@angular/core';
import { PreviousResult } from '../../models/mls-match.model';

@Component({
  selector: 'app-result-row',
  imports: [],
  template: `
    <div class="match">
      <div class="matchup result-matchup">
        <strong>{{ result().match.home_team_name }}</strong>
        <span class="score">{{ result().match.home_team_goals }} &ndash; {{ result().match.away_team_goals }}</span>
        <strong>{{ result().match.away_team_name }}</strong>
      </div>
      @if (result().goals.length > 0) {
        <div class="goal-links">
          @for (goal of result().goals; track $index) {
            @if (goal.video_url) {
              <a [href]="goal.video_url" class="goal-link" target="_blank" rel="noopener">
                {{ goalLabel(goal.player_name, goal.minute, goal.is_own_goal, goal.is_penalty) }}
              </a>
            } @else {
              <span class="goal-item">
                {{ goalLabel(goal.player_name, goal.minute, goal.is_own_goal, goal.is_penalty) }}
              </span>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .result-matchup {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 14px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 4px;
      line-height: 1.4;
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
  `]
})
export class ResultRowComponent {
  result = input.required<PreviousResult>();

  goalLabel(playerName: string, minute: number, isOwnGoal: boolean, isPenalty: boolean): string {
    const ball = '\u26BD';
    if (!playerName) return `${ball} Goal`;
    const minutePart = minute > 0 ? ` ${minute}'` : '';
    const ogPart = isOwnGoal ? ' (OG)' : '';
    const penPart = isPenalty ? ' (P)' : '';
    return `${ball} ${playerName}${minutePart}${ogPart}${penPart}`;
  }
}
