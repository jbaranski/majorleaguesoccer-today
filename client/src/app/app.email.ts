import { Component, ChangeDetectionStrategy } from '@angular/core';
import { HeaderComponent } from './components/header/header.email.component';
import { MatchListComponent } from './components/match-list/match-list.email.component';
import { FooterComponent } from './components/footer/footer.email.component';

@Component({
  selector: 'app-root',
  imports: [HeaderComponent, MatchListComponent, FooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.email.html'
})
export class App {}
