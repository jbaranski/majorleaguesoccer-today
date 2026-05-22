import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { MLSMatch, MatchResult } from '../../models/mls-match.model';
import { MatchFormatter } from '../../utils/match-formatter';
import { MatchRowComponent } from '../match-row/match-row.component';

@Component({
  selector: 'app-competition-card',
  imports: [MatchRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="border-2 border-border mb-4 overflow-hidden">
      <div [class]="headerClass()">
        <div class="text-2xl font-bold uppercase tracking-[0.5px] mb-1 leading-[1.2] text-foreground">{{ competition() }}</div>
        <div class="text-lg italic text-muted-foreground mb-1">{{ formattedDate() }}</div>
        <div class="flex gap-2 items-center">
          <span class="text-lg font-medium text-muted-foreground">Match Day {{ matchDay() }}</span>
          <span class="text-lg text-muted-foreground">-</span>
          <span class="text-lg font-medium text-muted-foreground">{{ season() }} Season</span>
        </div>
      </div>
      <div>
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

  headerClass = computed(() =>
    `${this.isResult() ? 'bg-card-result' : 'bg-card-header'} pt-2.5 px-3 pb-1.5 sm:pt-3 sm:px-4 sm:pb-2 border-b-2 border-border`
  );

  formattedDate = computed(() => {
    const first = this.firstMatch();
    return first ? MatchFormatter.formatDate(first.planned_kickoff_time) : '';
  });

  matchDay = computed(() => this.firstMatch()?.match_day ?? 0);

  season = computed(() => this.firstMatch()?.season ?? 0);
}
