import { Component, ChangeDetectionStrategy } from '@angular/core';
import { HeaderComponent } from './components/header/header.component';
import { MatchListComponent } from './components/match-list/match-list.component';
import { EmailCollectorWrapperComponent } from './components/email-collector-wrapper/email-collector-wrapper.component';
import { FooterComponent } from './components/footer/footer.component';

@Component({
  selector: 'app-root',
  imports: [HeaderComponent, MatchListComponent, EmailCollectorWrapperComponent, FooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
