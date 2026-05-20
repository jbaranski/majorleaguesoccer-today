import { Component, OnInit, signal, inject, computed, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatchDataService } from '../../services/match-data.service';
import { MLSMatch } from '../../models/mls-match.model';
import { MatchFormatter } from '../../utils/match-formatter';
import { CompetitionCardComponent } from '../competition-card/competition-card.component';

@Component({
  selector: 'app-match-list',
  imports: [CompetitionCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="text-center text-gray-500 text-sm">Loading today's matches...</div>
    } @else if (error()) {
      <div class="text-center text-red-500 text-sm">{{ error() }}</div>
    } @else {
      <div class="text-center text-gray-500 text-sm mb-4">Last updated: {{ lastUpdated() }}</div>
      @if (competitions().size === 0) {
        <div class="text-center text-gray-500 text-sm mt-4">No games scheduled for today</div>
      } @else {
        @for (competition of competitionEntries(); track competition[0]) {
          <app-competition-card
            [competition]="competition[0]"
            [matches]="competition[1]"
          />
        }
      }
    }
  `
})
export class MatchListComponent implements OnInit {
  private matchDataService = inject(MatchDataService);
  private destroyRef = inject(DestroyRef);

  loading = signal(true);
  error = signal<string>('');
  lastUpdated = signal<string>('');
  competitions = signal<Map<string, readonly MLSMatch[]>>(new Map());

  competitionEntries = computed(() => Array.from(this.competitions().entries()));

  ngOnInit(): void {
    this.matchDataService.fetchMatches()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
}
