import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif`;
const LINK = `color: #3b82f6; text-decoration: none;`;

@Component({
  selector: 'app-footer',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
    <div style="text-align: center; color: #6b7280; font-size: 16px; margin: 16px 0 12px; font-family: ${FONT};">
      <a href="https://github.com/jbaranski/majorleaguesoccer-today" target="_blank" rel="noopener" style="${LINK}"
        >Source code</a
      >
      used to generate the daily fixture list is free and open source :)
    </div>
    <div
      style="text-align: center; color: #6b7280; font-size: 14px; font-weight: 300; margin-bottom: 12px; font-family: ${FONT};"
    >
      Copyright 2026
      <a href="https://www.jeffsoftware.com" target="_blank" rel="noopener" style="${LINK} font-weight: 400;"
        >Jeff Software</a
      >
      |
      <a [href]="unsubscribeUrl" style="${LINK} font-weight: 400;">Unsubscribe</a>
    </div>
  `
})
export class FooterComponent {
  private readonly sanitizer = inject(DomSanitizer);
  readonly unsubscribeUrl = this.sanitizer.bypassSecurityTrustUrl('{{UNSUBSCRIBE_URL}}');
}
