import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { MLSMatch, GoalEvent } from '../../models/mls-match.model';
import { MatchFormatter } from '../../utils/match-formatter';

@Component({
  selector: 'app-match-row',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="px-3 py-2.5 sm:px-4 sm:py-3 border-b-2 border-border last:border-b-0 hover:bg-muted">
      @if (isResult()) {
        <div class="flex items-center gap-2 text-2xl font-bold text-foreground leading-[1.4]">
          <strong class="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-left">{{ match().home_team_name }}</strong>
          <span class="flex-shrink-0 text-[28px] font-extrabold text-foreground bg-muted px-2 py-0.5 rounded">{{ scoreLabel() }}</span>
          <strong class="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-right">{{ match().away_team_name }}</strong>
        </div>
        @if (goalEvents().length > 0) {
          <div class="mt-1.5">
            @for (goal of goalEvents(); track goal.playerName + goal.minute) {
              <div [class]="goal.side === 'away' ? 'text-xl py-0.5 text-right' : 'text-xl py-0.5'">
                @if (goal.videoUrl) {
                  <a [href]="goal.videoUrl" target="_blank" rel="noopener" class="text-primary hover:underline">{{ goalLabel(goal) }}</a>
                } @else {
                  <span>{{ goalLabel(goal) }}</span>
                }
              </div>
            }
          </div>
        }
      } @else {
        <div class="flex items-center gap-2 text-2xl font-bold text-foreground mb-1 leading-[1.4]">
          <strong class="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-left">{{ match().home_team_name }}</strong>
          <span class="flex-shrink-0 text-xl font-semibold text-primary bg-primary-subtle px-2 py-0.5 rounded">{{ formattedKickoffTime() }}</span>
          <strong class="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-right">{{ match().away_team_name }}</strong>
        </div>
        <div class="mt-0.5">
          <div class="text-lg text-muted-foreground mb-1">{{ match().stadium_name }}, {{ match().stadium_city }}, {{ match().stadium_country }}</div>
          @if (match().neutral_venue) {
            <div class="text-base text-muted-foreground font-medium mt-0.5">
              <span class="text-accent-amber font-semibold text-base">Neutral Venue</span>
            </div>
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
