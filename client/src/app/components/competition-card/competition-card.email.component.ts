import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { MLSMatch, MatchResult } from '../../models/mls-match.model';
import { MatchFormatter } from '../../utils/match-formatter';
import { MatchRowComponent } from '../match-row/match-row.email.component';

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif`;

@Component({
  selector: 'app-competition-card',
  imports: [MatchRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.display]': '"block"' },
  template: `
    <div style="border: 2px solid #e5e7eb; margin-bottom: 16px; font-family: ${FONT};">
      <div
        [style.background-color]="isResult() ? '#f0fdf4' : '#ede9fe'"
        style="padding: 10px 12px 6px; border-bottom: 2px solid #e5e7eb;"
      >
        <div
          style="font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #1f2937; line-height: 1.2; margin-bottom: 4px;"
        >
          {{ competition() }}
        </div>
        <div style="font-size: 16px; font-style: italic; color: #4b5563; margin-bottom: 4px;">
          {{ formatDate() }}
        </div>
        <div style="font-size: 14px; color: #6b7280;">
          Match Day {{ getMatchDay() }} - {{ getSeason() }} Season
        </div>
      </div>
      @if (isResult()) {
        @for (result of results(); track result.match['match_id']) {
          <app-match-row
            [match]="result.match"
            [goalEvents]="result.goalEvents"
            [isResult]="true"
          />
        }
      } @else {
        @for (match of matches(); track match['match_id']) {
          <app-match-row [match]="match" />
        }
      }
    </div>
  `,
})
export class CompetitionCardComponent {
  competition = input.required<string>();
  matches = input<readonly MLSMatch[]>([]);
  results = input<readonly MatchResult[]>([]);
  isResult = input<boolean>(false);

  private firstMatch = computed(() =>
    this.isResult() ? this.results()[0]?.match : this.matches()[0],
  );

  formatDate(): string {
    const first = this.firstMatch();
    return first ? MatchFormatter.formatDate(first.planned_kickoff_time) : '';
  }

  getMatchDay(): number {
    return this.firstMatch()?.match_day ?? 0;
  }

  getSeason(): number {
    return this.firstMatch()?.season ?? 0;
  }
}
