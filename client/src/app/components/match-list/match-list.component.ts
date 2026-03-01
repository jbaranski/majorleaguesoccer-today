import { Component, OnInit, signal, inject } from '@angular/core';
import { MatchDataService } from '../../services/match-data.service';
import { MLSMatch, PreviousResult } from '../../models/mls-match.model';
import { MatchFormatter } from '../../utils/match-formatter';
import { CompetitionCardComponent } from '../competition-card/competition-card.component';
import { ResultsCardComponent } from '../results-card/results-card.component';

@Component({
  selector: 'app-match-list',
  imports: [CompetitionCardComponent, ResultsCardComponent],
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
      @if (resultCompetitionEntries().length > 0) {
        <hr class="section-separator">
        <h2 class="section-title">Yesterday&#39;s Results</h2>
        @for (entry of resultCompetitionEntries(); track entry[0]) {
          <app-results-card
            [competition]="entry[0]"
            [results]="entry[1]"
          />
        }
      }
    }
  `,
  styles: [`
    .section-separator {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 24px 0 16px 0;
    }
    .section-title {
      color: #1f2937;
      font-size: 1.125rem;
      font-weight: 700;
      margin-bottom: 12px;
      margin-top: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e5e7eb;
    }
  `]
})
export class MatchListComponent implements OnInit {
  private matchDataService = inject(MatchDataService);

  loading = signal(true);
  error = signal<string>('');
  lastUpdated = signal<string>('');
  competitions = signal<Map<string, MLSMatch[]>>(new Map());
  resultCompetitions = signal<Map<string, PreviousResult[]>>(new Map());

  ngOnInit(): void {
    this.matchDataService.fetchMatches().subscribe({
      next: (data) => {
        const grouped = MatchFormatter.groupByCompetition(data.matches);
        this.competitions.set(grouped);
        this.lastUpdated.set(data.lastUpdated);

        const resultGrouped = this.groupResultsByCompetition(data.previousResults ?? []);
        this.resultCompetitions.set(resultGrouped);

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

  resultCompetitionEntries(): [string, PreviousResult[]][] {
    return Array.from(this.resultCompetitions().entries());
  }

  private groupResultsByCompetition(results: readonly PreviousResult[]): Map<string, PreviousResult[]> {
    const groups = new Map<string, PreviousResult[]>();
    for (const result of results) {
      const key = result.match.competition_name;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(result);
    }
    return groups;
  }
}
