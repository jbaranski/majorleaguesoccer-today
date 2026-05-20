import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { MLSMatch } from '../../models/mls-match.model';
import { MatchFormatter } from '../../utils/match-formatter';

@Component({
  selector: 'app-match-row',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="px-4 py-3 border-b-2 border-gray-200 transition-colors duration-200 hover:bg-gray-50">
      <div class="text-sm font-bold text-gray-800 mb-1 leading-snug">
        {{ match().home_team_name }} vs {{ match().away_team_name }}
      </div>
      <div class="text-[13px] font-medium text-gray-600 mb-1">{{ formatTime(match().planned_kickoff_time) }}</div>
      <div class="text-[13px] text-gray-500">
        {{ match().stadium_name }}, {{ match().stadium_city }}, {{ match().stadium_country }}
      </div>
      @if (match().neutral_venue) {
        <div class="text-xs font-semibold text-amber-600 mt-1">Neutral Venue</div>
      }
    </div>
  `
})
export class MatchRowComponent {
  match = input.required<MLSMatch>();

  formatTime(isoString: string): string {
    return MatchFormatter.formatTime(isoString);
  }
}
