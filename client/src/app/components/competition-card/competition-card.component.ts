import { Component, input } from '@angular/core';
import { MLSMatch } from '../../models/mls-match.model';
import { MatchFormatter } from '../../utils/match-formatter';
import { MatchRowComponent } from '../match-row/match-row.component';

@Component({
  selector: 'app-competition-card',
  imports: [MatchRowComponent],
  template: `
    <div class="competition-card">
      <div class="competition-header">
        <div class="header-main">
          <div class="competition-name">{{ competition() }}</div>
          <div class="competition-date">{{ formatDate() }}</div>
        </div>
        <div class="header-meta">
          <span class="match-day">Match Day {{ getMatchDay() }}</span>
          <span class="separator">-</span>
          <span class="season">{{ getSeason() }} Season</span>
        </div>
      </div>
      <div class="matches-list">
        @for (match of matches(); track match['match_id']) {
          <app-match-row [match]="match" />
        }
      </div>
    </div>
  `,
  styles: []
})
export class CompetitionCardComponent {
  competition = input.required<string>();
  matches = input.required<readonly MLSMatch[]>();

  formatDate(): string {
    const firstMatch = this.matches()[0];
    return firstMatch ? MatchFormatter.formatDate(firstMatch.planned_kickoff_time) : '';
  }

  getMatchDay(): number {
    const firstMatch = this.matches()[0];
    return firstMatch?.match_day ?? 0;
  }

  getSeason(): number {
    const firstMatch = this.matches()[0];
    return firstMatch?.season ?? 0;
  }
}
