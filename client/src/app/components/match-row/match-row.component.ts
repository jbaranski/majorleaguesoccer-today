import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { MLSMatch, GoalEvent } from '../../models/mls-match.model';
import { MatchFormatter } from '../../utils/match-formatter';

@Component({
  selector: 'app-match-row',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="py-4 px-1 hover:bg-muted rounded-lg transition-colors">
      <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span class="text-base font-semibold text-foreground leading-snug">{{ match().home_team_name }}</span>

        @if (isResult()) {
          <span class="text-base font-black text-score-fg bg-score-bg px-4 py-1.5 rounded-lg tabular-nums whitespace-nowrap">
            {{ scoreLabel() }}
          </span>
        } @else {
          <span class="text-sm font-bold text-kickoff-fg bg-kickoff-bg px-3 py-1.5 rounded-full whitespace-nowrap">
            {{ formattedKickoffTime() }}
          </span>
        }

        <span class="text-base font-semibold text-foreground leading-snug text-right">{{ match().away_team_name }}</span>
      </div>

      @if (isResult() && goalEvents().length > 0) {
        <div class="grid grid-cols-[1fr_auto_1fr] gap-3 mt-2">
          <div class="space-y-0.5">
            @for (goal of homeGoals(); track goal.playerName + goal.minute) {
              <div class="text-sm text-muted-foreground leading-snug">
                @if (goal.videoUrl) {
                  <a [href]="goal.videoUrl" target="_blank" rel="noopener" class="text-primary hover:underline">{{ goalLabel(goal) }}</a>
                } @else {
                  {{ goalLabel(goal) }}
                }
              </div>
            }
          </div>
          <div></div>
          <div class="space-y-0.5 text-right">
            @for (goal of awayGoals(); track goal.playerName + goal.minute) {
              <div class="text-sm text-muted-foreground leading-snug">
                @if (goal.videoUrl) {
                  <a [href]="goal.videoUrl" target="_blank" rel="noopener" class="text-primary hover:underline">{{ goalLabel(goal) }}</a>
                } @else {
                  {{ goalLabel(goal) }}
                }
              </div>
            }
          </div>
        </div>
      }

      @if (!isResult()) {
        <div class="mt-1.5 text-sm text-muted-foreground">
          {{ match().stadium_name }}, {{ match().stadium_city }}
          @if (match().neutral_venue) {
            &nbsp;·&nbsp;<span class="text-accent-amber font-medium">Neutral Venue</span>
          }
        </div>
      }
    </div>
  `
})
export class MatchRowComponent {
  match = input.required<MLSMatch>();
  goalEvents = input<readonly GoalEvent[]>([]);
  isResult = input<boolean>(false);

  homeGoals = computed(() => this.goalEvents().filter(g => g.side === 'home'));
  awayGoals = computed(() => this.goalEvents().filter(g => g.side === 'away'));

  scoreLabel = computed(() => {
    const m = this.match();
    const home = m.home_team_goals ?? 0;
    const away = m.away_team_goals ?? 0;
    const homePk = m.home_team_penalty_goals ?? 0;
    const awayPk = m.away_team_penalty_goals ?? 0;
    if (m.home_team_goals == null || m.away_team_goals == null) return '? - ?';
    if ((homePk > 0 || awayPk > 0) && home === away) return `${home} - ${away} (PKs: ${homePk}-${awayPk})`;
    return `${home} - ${away}`;
  });

  formattedKickoffTime = computed(() =>
    MatchFormatter.formatTime(this.match().planned_kickoff_time)
  );

  goalLabel(goal: GoalEvent): string {
    return `${goal.playerName}${goal.isOwnGoal ? ' (OG)' : ''}, ${goal.minute}'`;
  }
}
