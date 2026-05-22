import { Component, OnInit, signal, inject, computed, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatchDataService } from '../../services/match-data.service';
import { MLSMatch, MatchResult } from '../../models/mls-match.model';
import { MatchFormatter } from '../../utils/match-formatter';
import { CompetitionCardComponent } from '../competition-card/competition-card.component';

@Component({
  selector: 'app-match-list',
  imports: [CompetitionCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="text-center text-muted-foreground text-xl mt-4 mb-2">Loading today's matches...</div>
    } @else if (error()) {
      <div class="text-center text-destructive text-xl mt-4 mb-2">{{ error() }}</div>
    } @else {
      <div class="text-center text-muted-foreground text-xl mt-4 mb-2">Last updated: {{ lastUpdated() }}</div>
      @if (todayCompetitions().size === 0) {
        <div class="text-center text-muted-foreground text-xl mt-4">No games scheduled for today</div>
      } @else {
        <div class="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3 mt-1">Today's Games</div>
        @for (entry of todayCompetitionEntries(); track entry[0]) {
          <app-competition-card [competition]="entry[0]" [matches]="entry[1]" />
        }
      }
      @if (yesterdayCompetitions().size > 0) {
        <hr class="border-0 border-t border-border my-6" />
        <div class="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3 mt-1">Yesterday's Results</div>
        @for (entry of yesterdayCompetitionEntries(); track entry[0]) {
          <app-competition-card [competition]="entry[0]" [results]="entry[1]" [isResult]="true" />
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
  todayCompetitions = signal<Map<string, readonly MLSMatch[]>>(new Map());
  yesterdayCompetitions = signal<Map<string, readonly MatchResult[]>>(new Map());

  todayCompetitionEntries = computed(() => Array.from(this.todayCompetitions().entries()));
  yesterdayCompetitionEntries = computed(() => Array.from(this.yesterdayCompetitions().entries()));

  ngOnInit(): void {
    this.matchDataService.fetchMatches()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.todayCompetitions.set(MatchFormatter.groupByCompetition(data.todayMatches));
          this.yesterdayCompetitions.set(MatchFormatter.groupResultsByCompetition(data.yesterdayResults));
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
