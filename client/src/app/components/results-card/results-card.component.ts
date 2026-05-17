import { Component, input } from '@angular/core';
import { PreviousResult } from '../../models/mls-match.model';
import { MatchFormatter } from '../../utils/match-formatter';
import { ResultRowComponent } from '../result-row/result-row.component';

@Component({
  selector: 'app-results-card',
  imports: [ResultRowComponent],
  template: `
    <div class="competition-card results-card">
      <div class="competition-header results-header">
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
        @for (result of results(); track result.match['match_id']) {
          <app-result-row [result]="result" />
        }
      </div>
    </div>
  `,
  styles: [`
    .results-card {
      border-color: #d1d5db;
    }
    .results-header {
      background: #f1f5f9;
    }
  `]
})
export class ResultsCardComponent {
  competition = input.required<string>();
  results = input.required<readonly PreviousResult[]>();

  formatDate(): string {
    const first = this.results()[0]?.match;
    return first ? MatchFormatter.formatDate(first.planned_kickoff_time) : '';
  }

  getMatchDay(): number {
    return this.results()[0]?.match.match_day ?? 0;
  }

  getSeason(): number {
    return this.results()[0]?.match.season ?? 0;
  }
}
