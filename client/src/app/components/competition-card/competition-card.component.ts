import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { MLSMatch, MatchResult } from '../../models/mls-match.model';
import { MatchFormatter } from '../../utils/match-formatter';
import { MatchRowComponent } from '../match-row/match-row.component';

@Component({
  selector: 'app-competition-card',
  imports: [MatchRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-8">
      <div class="mb-3">
        <div class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{{ competition() }}</div>
        <div class="text-xs text-muted-foreground mt-0.5">{{ formattedDate() }} &nbsp;·&nbsp; Match Day {{ matchDay() }} &nbsp;·&nbsp; {{ season() }}</div>
      </div>
      <div class="divide-y divide-border">
        @if (isResult()) {
          @for (result of results(); track result.match.match_id) {
            <app-match-row [match]="result.match" [goalEvents]="result.goalEvents" [isResult]="true" />
          }
        } @else {
          @for (match of matches(); track match.match_id) {
            <app-match-row [match]="match" />
          }
        }
      </div>
    </div>
  `
})
export class CompetitionCardComponent {
  competition = input.required<string>();
  matches = input<readonly MLSMatch[]>([]);
  results = input<readonly MatchResult[]>([]);
  isResult = input<boolean>(false);

  private firstMatch = computed(() =>
    this.isResult() ? this.results()[0]?.match : this.matches()[0]
  );

  formattedDate = computed(() => {
    const first = this.firstMatch();
    return first ? MatchFormatter.formatDate(first.planned_kickoff_time) : '';
  });

  matchDay = computed(() => this.firstMatch()?.match_day ?? 0);

  season = computed(() => this.firstMatch()?.season ?? 0);
}
