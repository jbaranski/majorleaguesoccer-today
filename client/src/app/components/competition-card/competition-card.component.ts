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
      <div class="bg-purple-100 pt-[10px] px-3 pb-[6px] sm:pt-3 sm:px-4 sm:pb-2 border-b-2 border-gray-200">
        <div class="text-2xl font-bold uppercase tracking-[0.5px] mb-1 leading-[1.2] text-gray-800">{{ competition() }}</div>
        <div class="text-lg italic text-gray-600 mb-1">{{ formatDate() }}</div>
        <div class="flex gap-2 items-center">
          <span class="text-lg font-medium text-gray-500">Match Day {{ getMatchDay() }}</span>
          <span class="text-lg text-gray-500">-</span>
          <span class="text-lg font-medium text-gray-500">{{ getSeason() }} Season</span>
        </div>
      </div>
      <div>
        @for (match of matches(); track match['match_id']) {
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
