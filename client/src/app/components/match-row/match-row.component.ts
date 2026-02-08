import { Component, input } from '@angular/core';
import { MLSMatch } from '../../models/mls-match.model';
import { MatchFormatter } from '../../utils/match-formatter';

@Component({
  selector: 'app-match-row',
  imports: [],
  template: `
    <div class="match">
      <div class="matchup">
        <strong>{{ match().home_team_name }} vs {{ match().away_team_name }}</strong>
      </div>
      <div class="datetime">{{ formatTime(match().planned_kickoff_time) }}</div>
      <div class="venue">
        <div class="stadium">{{ match().stadium_name }}, {{ match().stadium_city }}, {{ match().stadium_country }}</div>
        @if (match().neutral_venue) {
          <div class="details">
            <span class="neutral">Neutral Venue</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: []
})
export class MatchRowComponent {
  match = input.required<MLSMatch>();

  formatTime(isoString: string): string {
    return MatchFormatter.formatTime(isoString);
  }
}
