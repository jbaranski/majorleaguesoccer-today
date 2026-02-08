import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { MatchListComponent } from './components/match-list/match-list.component';
import { EmailCollectorWrapperComponent } from './components/email-collector-wrapper/email-collector-wrapper.component';
import { FooterComponent } from './components/footer/footer.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    HeaderComponent,
    MatchListComponent,
    EmailCollectorWrapperComponent,
    FooterComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
