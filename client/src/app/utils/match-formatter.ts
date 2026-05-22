import { MLSMatch, MatchResult } from '../models/mls-match.model';

export class MatchFormatter {
  static formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York'
    }) + ' ET';
  }

  static formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      timeZone: 'America/New_York'
    });
  }

  static groupByCompetition(matches: readonly MLSMatch[]): Map<string, readonly MLSMatch[]> {
    const groups = new Map<string, MLSMatch[]>();

    for (const match of matches) {
      const competitionName = match.competition_name;
      if (!groups.has(competitionName)) {
        groups.set(competitionName, []);
      }
      groups.get(competitionName)!.push(match);
    }

    return groups;
  }

  static groupResultsByCompetition(results: readonly MatchResult[]): Map<string, readonly MatchResult[]> {
    const groups = new Map<string, MatchResult[]>();
    for (const result of results) {
      const name = result.match.competition_name;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name)!.push(result);
    }
    return groups;
  }
}
