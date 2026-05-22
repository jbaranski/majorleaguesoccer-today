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
      <div class="text-center text-muted-foreground text-base py-12">Loading today's matches...</div>
    } @else if (error()) {
      <div class="text-center text-destructive text-base py-12">{{ error() }}</div>
    } @else {
      <p class="text-sm text-muted-foreground text-center mb-8">Last updated: {{ lastUpdated() }}</p>

      @if (todayCompetitions().size === 0) {
        <div class="text-center text-muted-foreground text-base py-8">No games scheduled for today</div>
      } @else {
        <div class="flex items-center gap-2.5 mb-6">
          <div class="w-[3px] h-5 bg-primary rounded-full flex-shrink-0"></div>
          <span class="text-base font-bold text-foreground">Today's Games</span>
        </div>
        @for (entry of todayCompetitionEntries(); track entry[0]) {
          <app-competition-card [competition]="entry[0]" [matches]="entry[1]" />
        }
      }

      @if (yesterdayCompetitions().size > 0) {
        <div class="flex items-center gap-2.5 mt-10 mb-6">
          <div class="w-[3px] h-5 bg-primary rounded-full flex-shrink-0"></div>
          <span class="text-base font-bold text-foreground">Yesterday's Results</span>
        </div>
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
