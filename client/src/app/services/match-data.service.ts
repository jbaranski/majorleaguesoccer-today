import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MatchesData } from '../models/mls-match.model';

@Injectable({
  providedIn: 'root'
})
export class MatchDataService {
  private http = inject(HttpClient);

  fetchMatches(): Observable<MatchesData> {
    return this.http.get<MatchesData>('/matches.json');
  }
}
