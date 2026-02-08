import { Component, OnInit, signal, inject } from '@angular/core';
import { MatchDataService } from '../../services/match-data.service';
import { MLSMatch } from '../../models/mls-match.model';
import { MatchFormatter } from '../../utils/match-formatter';
import { CompetitionCardComponent } from '../competition-card/competition-card.component';

@Component({
  selector: 'app-match-list',
  imports: [CompetitionCardComponent],
  template: `
    @if (loading()) {
      <div class="last-updated">Loading today's matches...</div>
    } @else if (error()) {
      <div class="last-updated" style="color: #ef4444;">{{ error() }}</div>
    } @else {
      <div class="last-updated">Last updated: {{ lastUpdated() }}</div>
      @if (competitions().size === 0) {
        <div class="no-games">No games scheduled for today</div>
      } @else {
        @for (competition of competitionEntries(); track competition[0]) {
          <app-competition-card
            [competition]="competition[0]"
            [matches]="competition[1]"
          />
        }
      }
    }
  `,
  styles: []
})
export class MatchListComponent implements OnInit {
  private matchDataService = inject(MatchDataService);

  loading = signal(true);
  error = signal<string>('');
  lastUpdated = signal<string>('');
  competitions = signal<Map<string, MLSMatch[]>>(new Map());

  ngOnInit(): void {
    this.matchDataService.fetchMatches().subscribe({
      next: (data) => {
        const grouped = MatchFormatter.groupByCompetition(data.matches);
        this.competitions.set(grouped);
        this.lastUpdated.set(data.lastUpdated);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error fetching matches:', err);
        this.error.set('Failed to load match data. Please try again later.');
        this.loading.set(false);
      }
    });
  }

  competitionEntries(): [string, MLSMatch[]][] {
    return Array.from(this.competitions().entries());
  }
}
