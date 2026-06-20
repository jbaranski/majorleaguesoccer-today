import {
  Component,
  OnInit,
  signal,
  inject,
  computed,
  ChangeDetectionStrategy,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatchDataService } from '../../services/match-data.email.service';
import { MLSMatch, MatchResult } from '../../models/mls-match.model';
import { MatchFormatter } from '../../utils/match-formatter';
import { CompetitionCardComponent } from '../competition-card/competition-card.email.component';

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif`;
const SECTION_HEADER = `font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.025em; color: #374151; margin-bottom: 12px; margin-top: 32px; font-family: ${FONT};`;

@Component({
  selector: 'app-match-list',
  imports: [CompetitionCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div
        style="text-align: center; color: #6b7280; font-size: 16px; margin: 16px 0 8px; font-family: ${FONT};"
      >
        Loading today's matches...
      </div>
    } @else if (error()) {
      <div
        style="text-align: center; color: #ef4444; font-size: 16px; margin: 16px 0 8px; font-family: ${FONT};"
      >
        {{ error() }}
      </div>
    } @else {
      @if (todayCompetitions().size === 0) {
        <div
          style="text-align: center; color: #6b7280; font-size: 16px; margin-top: 16px; font-family: ${FONT};"
        >
          No games scheduled for today
        </div>
      } @else {
        <div style="${SECTION_HEADER}">Today's Games</div>
        @for (entry of todayCompetitionEntries(); track entry[0]) {
          <app-competition-card [competition]="entry[0]" [matches]="entry[1]" />
        }
      }
      @if (yesterdayCompetitions().size > 0) {
        <div style="${SECTION_HEADER}">Yesterday's Results</div>
        @for (entry of yesterdayCompetitionEntries(); track entry[0]) {
          <app-competition-card [competition]="entry[0]" [results]="entry[1]" [isResult]="true" />
        }
      }
    }
  `,
})
export class MatchListComponent implements OnInit {
  private matchDataService = inject(MatchDataService);
  private destroyRef = inject(DestroyRef);

  loading = signal(true);
  error = signal<string>('');
  todayCompetitions = signal<Map<string, readonly MLSMatch[]>>(new Map());
  yesterdayCompetitions = signal<Map<string, readonly MatchResult[]>>(new Map());

  todayCompetitionEntries = computed(() => Array.from(this.todayCompetitions().entries()));
  yesterdayCompetitionEntries = computed(() => Array.from(this.yesterdayCompetitions().entries()));

  ngOnInit(): void {
    this.matchDataService
      .fetchMatches()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.todayCompetitions.set(MatchFormatter.groupByCompetition(data.todayMatches));
          this.yesterdayCompetitions.set(
            MatchFormatter.groupResultsByCompetition(data.yesterdayResults),
          );
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Error fetching matches:', err);
          this.error.set('Failed to load match data. Please try again later.');
          this.loading.set(false);
        },
      });
  }
}
