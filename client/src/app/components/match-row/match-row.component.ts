import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { MLSMatch } from '../../models/mls-match.model';
import { MatchFormatter } from '../../utils/match-formatter';

@Component({
  selector: 'app-match-row',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="px-3 py-[10px] sm:px-4 sm:py-3 border-b-2 border-gray-200 last:border-b-0 transition-colors duration-200 hover:bg-gray-50">
      <div class="text-3xl font-bold text-gray-800 mb-1 leading-[1.4]">
        <strong>{{ match().home_team_name }} vs {{ match().away_team_name }}</strong>
      </div>
      <div class="text-2xl font-medium text-gray-600 mb-1">{{ formatTime(match().planned_kickoff_time) }}</div>
      <div class="mt-0.5">
        <div class="text-2xl text-gray-500 mb-1">{{ match().stadium_name }}, {{ match().stadium_city }}, {{ match().stadium_country }}</div>
        @if (match().neutral_venue) {
          <div class="text-2xl text-gray-500 font-medium mt-0.5">
            <span class="text-amber-600 font-semibold text-2xl">Neutral Venue</span>
          </div>
        }
      </div>
    </div>
  `
})
export class MatchRowComponent {
  match = input.required<MLSMatch>();

  formatTime(isoString: string): string {
    return MatchFormatter.formatTime(isoString);
  }
}
