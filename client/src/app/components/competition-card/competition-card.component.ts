import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { MLSMatch } from '../../models/mls-match.model';
import { MatchFormatter } from '../../utils/match-formatter';
import { MatchRowComponent } from '../match-row/match-row.component';

@Component({
  selector: 'app-competition-card',
  imports: [MatchRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="border-2 border-gray-200 mb-4 overflow-hidden">
      <div class="bg-purple-100 px-4 py-3 border-b-2 border-gray-200">
        <div class="text-sm font-bold uppercase tracking-wide text-gray-800 mb-1 leading-tight">{{ competition() }}</div>
        <div class="text-sm text-gray-600 italic mb-1">{{ formatDate() }}</div>
        <div class="flex gap-2 items-center">
          <span class="text-xs font-medium text-gray-500">Match Day {{ getMatchDay() }}</span>
          <span class="text-xs text-gray-500">-</span>
          <span class="text-xs font-medium text-gray-500">{{ getSeason() }} Season</span>
        </div>
      </div>
      <div>
        @for (match of matches(); track match.planned_kickoff_time + match.home_team_name) {
          <app-match-row [match]="match" />
        }
      </div>
    </div>
  `
})
export class CompetitionCardComponent {
  competition = input.required<string>();
  matches = input.required<readonly MLSMatch[]>();

  private firstMatch = computed(() => this.matches()[0]);

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
