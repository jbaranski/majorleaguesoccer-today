import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-header',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1
      style="font-size: 36px; font-weight: bold; text-align: center; color: #1f2937; margin-bottom: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.2;"
    >
      Major League Soccer Today
    </h1>
  `
})
export class HeaderComponent {}
