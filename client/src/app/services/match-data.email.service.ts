import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { MatchesData } from '../models/mls-match.model';
import matchesData from '../../../public/matches.json';

@Injectable({
  providedIn: 'root',
})
export class MatchDataService {
  fetchMatches(): Observable<MatchesData> {
    return of(matchesData as MatchesData);
  }
}
